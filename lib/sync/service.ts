import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import { requireWorkspacePermission } from "@/lib/api/workspace-access";
import type { z } from "zod";
import { registerDeviceSchema, syncRequestSchema } from "@/lib/validation/sync";

const entityTables = {
  task: "tasks",
  project: "projects",
  note: "notes",
  document: "documents",
} as const;

const writePermissions = {
  CREATE: "CREATE",
  UPDATE: "EDIT",
  DELETE: "DELETE",
} as const;

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonicalJson).join(",") + "]";
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return "{" + entries.map(([key, item]) => JSON.stringify(key) + ":" + canonicalJson(item)).join(",") + "}";
  }
  return JSON.stringify(value) ?? "null";
}

function sameInstant(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return Number.isFinite(leftTime) && leftTime === rightTime;
}

function matchesIdempotentRequest(
  existing: {
    workspace_id: string | null;
    entity_type: string;
    entity_id: string;
    operation: string;
    base_version: number | null;
    client_timestamp: string;
    payload: unknown;
  },
  input: z.infer<typeof syncRequestSchema>,
) {
  return (
    existing.workspace_id === input.workspace_id &&
    existing.entity_type === input.entity_type &&
    existing.entity_id === input.entity_id &&
    existing.operation === input.operation &&
    existing.base_version === (input.base_version ?? null) &&
    sameInstant(existing.client_timestamp, input.client_timestamp) &&
    canonicalJson(existing.payload ?? {}) === canonicalJson(input.payload ?? {})
  );
}

export async function registerDevice(
  supabase: SupabaseClient,
  user: User,
  input: z.infer<typeof registerDeviceSchema>,
) {
  const { data, error } = await supabase
    .from("devices")
    .insert({ ...input, user_id: user.id, last_seen_at: new Date().toISOString() })
    .select("id,device_name,device_type,platform,app_version,last_seen_at,last_sync_at,created_at")
    .single();

  if (error) throw new ApiError(500, "INTERNAL_ERROR", "Device could not be registered.");
  return data;
}

export async function queueSyncOperation(
  supabase: SupabaseClient,
  user: User,
  input: z.infer<typeof syncRequestSchema>,
) {
  const table = entityTables[input.entity_type];
  const permission = writePermissions[input.operation];

  await requireWorkspacePermission(supabase, input.workspace_id, input.entity_type, permission);

  const { data: device, error: deviceError } = await supabase
    .from("devices")
    .select("id")
    .eq("id", input.device_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (deviceError) throw new ApiError(500, "INTERNAL_ERROR", "Device could not be verified.");
  if (!device) throw new ApiError(403, "FORBIDDEN", "The device is not registered to this account.");

  // Retries must return the originally accepted operation rather than creating duplicates.
  if (input.client_operation_id) {
    const { data: existing, error: existingError } = await supabase
      .from("sync_operations")
      .select("id,client_operation_id,workspace_id,entity_type,entity_id,operation,base_version,client_timestamp,payload,status,created_at")
      .eq("user_id", user.id)
      .eq("device_id", input.device_id)
      .eq("client_operation_id", input.client_operation_id)
      .maybeSingle();

    if (existingError) throw new ApiError(500, "INTERNAL_ERROR", "Idempotency state could not be read.");
    if (existing) {
      if (!matchesIdempotentRequest(existing, input)) {
        throw new ApiError(409, "CONFLICT", "This client operation ID was already used for a different operation.");
      }
      return existing;
    }
  }

  let currentVersion: number | null = null;
  if (input.operation !== "CREATE") {
    const { data: current, error: currentError } = await supabase
      .from(table)
      .select("version")
      .eq("id", input.entity_id)
      .eq("workspace_id", input.workspace_id)
      .maybeSingle();

    if (currentError) throw new ApiError(500, "INTERNAL_ERROR", "Current record version could not be read.");
    if (!current) throw new ApiError(404, "NOT_FOUND", "The record to synchronize was not found.");
    currentVersion = Number(current.version);

    if (input.base_version === null || input.base_version === undefined || currentVersion !== input.base_version) {
      throw new ApiError(409, "CONFLICT", "The server record changed since this offline operation was created.", {
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        base_version: input.base_version ?? null,
        current_version: currentVersion,
        resolution: ["KEEP_SERVER", "KEEP_MINE", "MERGE", "REVIEW"],
      });
    }
  }

  const insertPayload = {
    device_id: input.device_id,
    user_id: user.id,
    workspace_id: input.workspace_id,
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    operation: input.operation,
    payload: input.payload,
    base_version: input.base_version ?? currentVersion,
    client_timestamp: input.client_timestamp,
    status: "PENDING",
    ...(input.client_operation_id ? { client_operation_id: input.client_operation_id } : {}),
  };

  const { data, error } = await supabase
    .from("sync_operations")
    .insert(insertPayload)
    .select("id,client_operation_id,workspace_id,entity_type,entity_id,operation,base_version,client_timestamp,payload,status,created_at")
    .single();

  // A concurrent retry can hit the unique index. Re-read by the same idempotency key.
  if (error && input.client_operation_id) {
    const { data: existing } = await supabase
      .from("sync_operations")
      .select("id,client_operation_id,workspace_id,entity_type,entity_id,operation,base_version,client_timestamp,payload,status,created_at")
      .eq("user_id", user.id)
      .eq("device_id", input.device_id)
      .eq("client_operation_id", input.client_operation_id)
      .maybeSingle();

    if (existing && matchesIdempotentRequest(existing, input)) return existing;
  }

  if (error) throw new ApiError(500, "INTERNAL_ERROR", "Sync operation could not be queued.");
  return data;
}

type SyncProcessResult = {
  id?: string;
  status?: "PENDING" | "SYNCING" | "SYNCED" | "CONFLICT" | "FAILED";
  server_version?: number | null;
  error_code?: string | null;
  server_timestamp?: string;
};

export async function processSyncOperation(supabase: SupabaseClient, operationId: string): Promise<SyncProcessResult> {
  const { data, error } = await supabase.rpc("process_sync_operation", {
    target_operation_id: operationId,
  });

  if (error) {
    throw new ApiError(500, "INTERNAL_ERROR", "The sync processor could not apply the queued operation.");
  }
  if (!data || typeof data !== "object") {
    throw new ApiError(500, "INTERNAL_ERROR", "The sync processor returned an invalid result.");
  }
  return data as SyncProcessResult;
}

export async function getSyncOperationStatus(
  supabase: SupabaseClient,
  user: User,
  clientOperationId: string,
) {
  const { data, error } = await supabase
    .from("sync_operations")
    .select("client_operation_id,entity_type,entity_id,operation,base_version,status,error_code,server_version,created_at,server_timestamp")
    .eq("user_id", user.id)
    .eq("client_operation_id", clientOperationId)
    .maybeSingle();

  if (error) throw new ApiError(500, "INTERNAL_ERROR", "Sync status could not be read.");
  if (!data) throw new ApiError(404, "NOT_FOUND", "Sync operation was not found.");
  return data;
}
