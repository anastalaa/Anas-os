import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import { requireWorkspacePermission } from "@/lib/api/workspace-access";
import {
  noteCreateSchema,
  noteUpdateSchema,
  projectCreateSchema,
  projectUpdateSchema,
  taskCreateSchema,
  taskUpdateSchema,
} from "@/lib/validation/core";
import type { z } from "zod";

async function assertUniqueResult<T>(query: PromiseLike<{ data: T; error: { code?: string; message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new ApiError(error.code === "23505" ? 409 : 500, error.code === "23505" ? "CONFLICT" : "INTERNAL_ERROR", error.message);
  return data;
}

export async function listTasks(supabase: SupabaseClient, workspaceId: string) {
  await requireWorkspacePermission(supabase, workspaceId, "task", "VIEW");
  const { data, error } = await supabase.from("tasks").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).order("created_at", { ascending: false });
  if (error) throw new ApiError(500, "INTERNAL_ERROR", "Tasks could not be loaded.");
  return data;
}

export async function createTask(supabase: SupabaseClient, user: User, workspaceId: string, input: z.infer<typeof taskCreateSchema>) {
  await requireWorkspacePermission(supabase, workspaceId, "task", "CREATE");
  return assertUniqueResult(supabase.from("tasks").insert({ ...input, workspace_id: workspaceId, created_by: user.id, updated_by: user.id }).select().single());
}

export async function updateTask(supabase: SupabaseClient, user: User, workspaceId: string, taskId: string, input: z.infer<typeof taskUpdateSchema>) {
  await requireWorkspacePermission(supabase, workspaceId, "task", "EDIT");
  return assertUniqueResult(supabase.from("tasks").update({ ...input, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", taskId).eq("workspace_id", workspaceId).is("deleted_at", null).select().single());
}

export async function listProjects(supabase: SupabaseClient, workspaceId: string) {
  await requireWorkspacePermission(supabase, workspaceId, "project", "VIEW");
  const { data, error } = await supabase.from("projects").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).order("created_at", { ascending: false });
  if (error) throw new ApiError(500, "INTERNAL_ERROR", "Projects could not be loaded.");
  return data;
}

export async function createProject(supabase: SupabaseClient, user: User, workspaceId: string, input: z.infer<typeof projectCreateSchema>) {
  await requireWorkspacePermission(supabase, workspaceId, "project", "CREATE");
  return assertUniqueResult(supabase.from("projects").insert({ ...input, workspace_id: workspaceId, owner_id: input.owner_id ?? user.id, created_by: user.id, updated_by: user.id }).select().single());
}

export async function updateProject(supabase: SupabaseClient, user: User, workspaceId: string, projectId: string, input: z.infer<typeof projectUpdateSchema>) {
  await requireWorkspacePermission(supabase, workspaceId, "project", "EDIT");
  return assertUniqueResult(supabase.from("projects").update({ ...input, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", projectId).eq("workspace_id", workspaceId).is("deleted_at", null).select().single());
}

export async function listNotes(supabase: SupabaseClient, workspaceId: string) {
  await requireWorkspacePermission(supabase, workspaceId, "note", "VIEW");
  const { data, error } = await supabase.from("notes").select("*").eq("workspace_id", workspaceId).is("deleted_at", null).order("updated_at", { ascending: false });
  if (error) throw new ApiError(500, "INTERNAL_ERROR", "Notes could not be loaded.");
  return data;
}

export async function createNote(supabase: SupabaseClient, user: User, workspaceId: string, input: z.infer<typeof noteCreateSchema>) {
  await requireWorkspacePermission(supabase, workspaceId, "note", "CREATE");
  return assertUniqueResult(supabase.from("notes").insert({ ...input, workspace_id: workspaceId, owner_id: input.owner_id ?? user.id, created_by: user.id, updated_by: user.id }).select().single());
}

export async function updateNote(supabase: SupabaseClient, user: User, workspaceId: string, noteId: string, input: z.infer<typeof noteUpdateSchema>) {
  await requireWorkspacePermission(supabase, workspaceId, "note", "EDIT");
  return assertUniqueResult(supabase.from("notes").update({ ...input, updated_by: user.id, updated_at: new Date().toISOString() }).eq("id", noteId).eq("workspace_id", workspaceId).is("deleted_at", null).select().single());
}
