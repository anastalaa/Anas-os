import { z } from "zod";

export const syncEntitySchema = z.enum(["task", "project", "note", "document"]);
export const syncOperationSchema = z.enum(["CREATE", "UPDATE", "DELETE"]);

export const syncRequestSchema = z.object({
  device_id: z.string().uuid(),
  workspace_id: z.string().uuid(),
  entity_type: syncEntitySchema,
  entity_id: z.string().uuid(),
  operation: syncOperationSchema,
  payload: z.record(z.string(), z.unknown()).default({}),
  base_version: z.number().int().nonnegative().nullable().optional(),
  client_timestamp: z.string().datetime({ offset: true }),
});

export const registerDeviceSchema = z.object({
  device_name: z.string().trim().min(1).max(120),
  device_type: z.string().trim().max(50).nullable().optional(),
  platform: z.string().trim().max(50).nullable().optional(),
  app_version: z.string().trim().max(50).nullable().optional(),
});
