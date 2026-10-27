import { z } from "zod";

export const uuidSchema = z.string().uuid();

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).nullable().optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "BLOCKED", "DONE", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  due_at: z.string().datetime({ offset: true }).nullable().optional(),
  assigned_to: uuidSchema.nullable().optional(),
  parent_task_id: uuidSchema.nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const taskUpdateSchema = taskCreateSchema.partial();

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(10000).nullable().optional(),
  status: z.enum(["PLANNED", "ACTIVE", "ON_HOLD", "COMPLETED", "ARCHIVED", "CANCELLED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  start_date: z.string().date().nullable().optional(),
  target_date: z.string().date().nullable().optional(),
  owner_id: uuidSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const projectUpdateSchema = projectCreateSchema.partial();

export const noteCreateSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.record(z.string(), z.unknown()).optional(),
  plain_text: z.string().max(100000).nullable().optional(),
  note_type: z.string().trim().min(1).max(50).optional(),
  owner_id: uuidSchema.optional(),
});

export const noteUpdateSchema = noteCreateSchema.partial();
