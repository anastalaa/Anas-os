import {
  listAllOperations,
  listPendingOperations,
  updateOperation,
} from "./idb";
import type { SyncOperation } from "./types";

const DEVICE_STORAGE_KEY = "anas-os-device-id";
const APP_VERSION = "0.1.0";
const SERVER_STATUS_POLL_MS = 5_000;

type ApiBody = {
  data?: { id?: string; status?: string; error_code?: string; [key: string]: unknown };
  error?: { code?: string; message?: string; details?: unknown };
};

export function calculateRetryDelayMs(attemptCount: number): number {
  const attempt = Math.max(1, Math.trunc(attemptCount));
  return Math.min(300_000, 1_000 * 2 ** Math.min(attempt - 1, 8));
}

function createClientOperationId(): string {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("Secure UUID generation is unavailable; sync was not started.");
  }
  return globalThis.crypto.randomUUID();
}

function entityKey(operation: Pick<SyncOperation, "entity" | "entityId">): string {
  return `${operation.entity}:${operation.entityId}`;
}

async function parseBody(response: Response): Promise<ApiBody> {
  try {
    return (await response.json()) as ApiBody;
  } catch {
    return {};
  }
}

async function getOrRegisterDevice(userId: string, fetcher: typeof fetch): Promise<string> {
  if (typeof window === "undefined") throw new Error("Sync requires a browser session.");
  const storageKey = DEVICE_STORAGE_KEY + ":" + userId;
  const storedId = window.localStorage.getItem(storageKey);
  if (storedId) return storedId;

  const response = await fetcher("/api/devices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expected_user_id: userId,
      device_name: "ANAS OS Web",
      device_type: "browser",
      platform: window.navigator.userAgent.slice(0, 50),
      app_version: APP_VERSION,
    }),
  });
  const body = await parseBody(response);
  const deviceId = body.data?.id;
  if (!response.ok || typeof deviceId !== "string") {
    throw new Error(body.error?.message ?? "This device could not be registered for sync.");
  }

  window.localStorage.setItem(storageKey, deviceId);
  return deviceId;
}

async function updateStatus(
  userId: string,
  operation: SyncOperation,
  status: SyncOperation["status"],
  patch: Partial<SyncOperation> = {},
) {
  await updateOperation(userId, {
    ...operation,
    ...patch,
    status,
    updatedAt: new Date().toISOString(),
  });
}

async function reconcileServerPending(fetcher: typeof fetch, userId: string, workspaceId?: string): Promise<void> {
  const operations = await listAllOperations(userId, workspaceId);
  for (const operation of operations) {
    if (operation.status !== "SERVER_PENDING" || !operation.clientOperationId) continue;
    if (typeof navigator !== "undefined" && !navigator.onLine) return;

    try {
      const response = await fetcher(
        `/api/sync/status?client_operation_id=${encodeURIComponent(operation.clientOperationId)}`,
        { method: "GET", cache: "no-store" },
      );
      const body = await parseBody(response);

      if (response.status === 404) {
        // The server has no record for this idempotency key; retry the same operation ID.
        await updateStatus(userId, operation, "PENDING", { error: undefined, retryable: true, nextRetryAt: null });
      } else if (!response.ok) {
        // Keep SERVER_PENDING: a temporary status-query failure does not prove the write failed.
        await updateStatus(userId, operation, "SERVER_PENDING", {
          nextRetryAt: new Date(Date.now() + SERVER_STATUS_POLL_MS).toISOString(),
        });
      } else if (body.data?.status === "SYNCED") {
        await updateStatus(userId, operation, "SYNCED", {
          error: undefined,
          retryable: false,
          nextRetryAt: null,
          serverVersion: typeof body.data.server_version === "number" ? body.data.server_version : operation.serverVersion,
        });
      } else if (body.data?.status === "CONFLICT") {
        const serverVersion = typeof body.data.server_version === "number" ? body.data.server_version : undefined;
        await updateStatus(userId, operation, "CONFLICT", {
          error: body.data?.error_code ? String(body.data.error_code) : "The server reported a synchronization conflict.",
          conflictDetails: serverVersion === undefined ? operation.conflictDetails : { server_version: serverVersion },
          serverVersion: serverVersion ?? operation.serverVersion,
          retryable: false,
          nextRetryAt: null,
        });
      } else if (body.data?.status === "FAILED") {
        await updateStatus(userId, operation, "ERROR", {
          error: body.data?.error_code ? String(body.data.error_code) : "The server failed to process this operation.",
          retryable: false,
          nextRetryAt: null,
        });
      } else {
        // PENDING/SYNCING responses get a bounded poll interval, not an immediate loop.
        await updateStatus(userId, operation, "SERVER_PENDING", {
          nextRetryAt: new Date(Date.now() + SERVER_STATUS_POLL_MS).toISOString(),
        });
      }
    } catch {
      // The server may still be processing; schedule a later status check rather than resubmitting.
      try {
        await updateStatus(userId, operation, "SERVER_PENDING", {
          nextRetryAt: new Date(Date.now() + SERVER_STATUS_POLL_MS).toISOString(),
        });
      } catch {
        return;
      }
    }
  }
}

export type SyncWorkerOptions = {
  userId: string;
  workspaceId?: string;
  fetcher?: typeof fetch;
  maxOperations?: number;
};

/**
 * Uploads local operations in creation order. HTTP 202 is only SERVER_PENDING;
 * the local operation is retained until the server status endpoint confirms SYNCED.
 */
export async function runSyncWorker(options: SyncWorkerOptions): Promise<void> {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!options.userId) throw new Error("An authenticated user is required for sync.");
  if (!navigator.onLine) return;

  const userId = options.userId;
  const fetcher = options.fetcher ?? fetch;
  await reconcileServerPending(fetcher, userId, options.workspaceId);

  // Do not create device records unless there is work that needs to be uploaded.
  const allOperations = await listAllOperations(userId, options.workspaceId);
  const pending = await listPendingOperations(userId, options.workspaceId);
  if (pending.length === 0) return;

  // A blocked operation must prevent newer changes to the same record from overtaking it.
  const now = Date.now();
  const blockedEntities = new Set(
    allOperations
      .filter((operation) => {
        if (operation.status === "SERVER_PENDING" || operation.status === "CONFLICT") return true;
        if (operation.status !== "ERROR") return false;
        if (operation.retryable === false) return true;
        return Boolean(operation.nextRetryAt && Date.parse(operation.nextRetryAt) > now);
      })
      .map(entityKey),
  );

  const deviceId = await getOrRegisterDevice(userId, fetcher);
  const queue = pending.slice(0, Math.max(1, options.maxOperations ?? 50));

  for (const queued of queue) {
    if (!navigator.onLine) return;
    if (blockedEntities.has(entityKey(queued))) continue;

    if (queued.entity === "capture") {
      await updateStatus(userId, queued, "ERROR", {
        error: "Capture sync is not supported by the server yet.",
        retryable: false,
        nextRetryAt: null,
      });
      blockedEntities.add(entityKey(queued));
      continue;
    }

    const operation: SyncOperation = {
      ...queued,
      clientOperationId: queued.clientOperationId ?? createClientOperationId(),
      attemptCount: queued.attemptCount ?? 0,
      retryable: true,
    };

    // Persist the idempotency key before network I/O, so interrupted uploads can be retried safely.
    await updateStatus(userId, operation, "SYNCING", { clientOperationId: operation.clientOperationId });

    try {
      const response = await fetcher("/api/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expected_user_id: userId,
          device_id: deviceId,
          workspace_id: operation.workspaceId,
          entity_type: operation.entity,
          entity_id: operation.entityId,
          operation: operation.operation,
          payload: operation.payload,
          base_version: operation.baseVersion,
          client_operation_id: operation.clientOperationId,
          client_timestamp: operation.createdAt,
        }),
      });
      const body = await parseBody(response);

      if (response.status === 409) {
        const details = body.error?.details && typeof body.error.details === "object"
          ? body.error.details as Record<string, unknown>
          : undefined;
        await updateStatus(userId, operation, "CONFLICT", {
          error: body.error?.message ?? "The server detected a version conflict.",
          conflictDetails: details,
          retryable: false,
          nextRetryAt: null,
        });
        blockedEntities.add(entityKey(operation));
        continue;
      }

      if (
        response.status === 403 &&
        body.error?.message === "The device is not registered to this account."
      ) {
        window.localStorage.removeItem(DEVICE_STORAGE_KEY + ":" + userId);
        await updateStatus(userId, operation, "PENDING", {
          error: "This device will be re-registered for the current account.",
          retryable: true,
          nextRetryAt: null,
        });
        return;
      }

      if (response.status === 401) {
        await updateStatus(userId, operation, "ERROR", {
          error: body.error?.message ?? "Sign in to resume synchronization, then retry this operation.",
          retryable: false,
          nextRetryAt: null,
        });
        blockedEntities.add(entityKey(operation));
        continue;
      }

      if (response.status === 429 || response.status >= 500) {
        const attempts = (operation.attemptCount ?? 0) + 1;
        await updateStatus(userId, operation, "ERROR", {
          attemptCount: attempts,
          error: body.error?.message ?? `Temporary sync failure (HTTP ${response.status}).`,
          retryable: true,
          nextRetryAt: new Date(Date.now() + calculateRetryDelayMs(attempts)).toISOString(),
        });
        return; // Preserve queue order after an ambiguous or transient failure.
      }

      if (!response.ok) {
        await updateStatus(userId, operation, "ERROR", {
          error: body.error?.message ?? `Sync request failed (HTTP ${response.status}).`,
          retryable: false,
          nextRetryAt: null,
        });
        blockedEntities.add(entityKey(operation));
        continue; // Other records can progress, but this record's newer writes stay blocked.
      }

      if (body.data?.status === "SYNCED") {
        await updateStatus(userId, operation, "SYNCED", {
          error: undefined,
          retryable: false,
          nextRetryAt: null,
          serverVersion: typeof body.data.server_version === "number" ? body.data.server_version : undefined,
        });
      } else {
        // 202 currently means accepted into the server queue, not applied to the entity.
        await updateStatus(userId, operation, "SERVER_PENDING", {
          error: undefined,
          retryable: false,
          nextRetryAt: new Date(Date.now() + SERVER_STATUS_POLL_MS).toISOString(),
        });
        blockedEntities.add(entityKey(operation));
      }
    } catch (error) {
      const attempts = (operation.attemptCount ?? 0) + 1;
      await updateStatus(userId, operation, "ERROR", {
        attemptCount: attempts,
        error: error instanceof Error ? error.message : "Network error while synchronizing.",
        retryable: true,
        nextRetryAt: new Date(Date.now() + calculateRetryDelayMs(attempts)).toISOString(),
      });
      return;
    }
  }
}

/** True when queued work can progress without overtaking an unresolved operation for the same record. */
export async function hasRunnableSyncOperations(userId: string, workspaceId?: string): Promise<boolean> {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.onLine) return false;

  const [allOperations, pending] = await Promise.all([
    listAllOperations(userId, workspaceId),
    listPendingOperations(userId, workspaceId),
  ]);
  const now = Date.now();
  const blockedEntities = new Set(
    allOperations
      .filter((operation) => {
        if (operation.status === "SERVER_PENDING" || operation.status === "CONFLICT") return true;
        if (operation.status !== "ERROR") return false;
        if (operation.retryable === false) return true;
        return Boolean(operation.nextRetryAt && Date.parse(operation.nextRetryAt) > now);
      })
      .map(entityKey),
  );

  return pending.some((operation) => !blockedEntities.has(entityKey(operation)));
}

/** Manually requeue failed operations. Conflicts require a separate resolution choice. */
export async function retryErroredOperations(userId: string, workspaceId?: string): Promise<void> {
  const operations = await listAllOperations(userId, workspaceId);
  for (const operation of operations) {
    if (operation.status !== "ERROR" || operation.entity === "capture") continue;
    await updateOperation(userId, {
      ...operation,
      status: "PENDING",
      clientOperationId: operation.retryable === false ? undefined : operation.clientOperationId,
      error: undefined,
      retryable: true,
      attemptCount: 0,
      nextRetryAt: null,
      updatedAt: new Date().toISOString(),
    });
  }
}

/** Allows an explicit retry action to requeue one error; conflicts must be resolved separately. */
export async function retrySyncOperation(userId: string, operation: SyncOperation): Promise<void> {
  if (operation.status !== "ERROR") {
    throw new Error("Only failed operations can be retried directly; conflicts need an explicit resolution.");
  }

  await updateOperation(userId, {
    ...operation,
    status: "PENDING",
    clientOperationId: operation.retryable === false ? undefined : operation.clientOperationId,
    error: undefined,
    retryable: true,
    attemptCount: 0,
    nextRetryAt: null,
    updatedAt: new Date().toISOString(),
  });
}
