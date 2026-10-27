import { z } from "zod";

export const workspaceTypeSchema = z.enum([
  "PERSONAL",
  "FAMILY",
  "PROFESSIONAL",
  "PROJECT",
  "SHARED",
]);

const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug must use lowercase letters, numbers, and hyphens.");

export const createWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(120),
  slug: slugSchema,
  type: workspaceTypeSchema,
  description: z.string().trim().max(2000).nullable().optional(),
  settings: z.record(z.string(), z.unknown()).optional(),
});

export const updateWorkspaceSchema = z
  .object({
    name: z.string().trim().min(1).max(120).optional(),
    slug: slugSchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    settings: z.record(z.string(), z.unknown()).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");

export const addWorkspaceMemberSchema = z.object({
  user_id: z.string().uuid(),
  role: z.enum(["ADMIN", "MANAGER", "MEMBER", "COLLABORATOR", "VIEWER"]),
  status: z.literal("INVITED").default("INVITED"),
});

export const updateWorkspaceMemberSchema = z
  .object({
    role: z.enum(["ADMIN", "MANAGER", "MEMBER", "COLLABORATOR", "VIEWER"]).optional(),
    status: z.enum(["ACTIVE", "SUSPENDED", "REMOVED"]).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, "At least one field is required.");
