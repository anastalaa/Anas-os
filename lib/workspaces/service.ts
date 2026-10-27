import type { SupabaseClient, User } from "@supabase/supabase-js";
import { ApiError } from "@/lib/api/errors";
import type { Database } from "@/lib/supabase/database.types";

// The service intentionally relies on Postgres RLS for the final authorization decision.
// Application checks provide deterministic API errors and prevent invalid state transitions.

type Client = SupabaseClient<Database>;

export async function listWorkspaces(supabase: Client, user: User) {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name,slug,type,description,owner_id,settings,created_at,updated_at")
    .order("updated_at", { ascending: false });

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function getWorkspace(supabase: Client, workspaceId: string) {
  const { data, error } = await supabase
    .from("workspaces")
    .select("id,name,slug,type,description,owner_id,settings,created_at,updated_at")
    .eq("id", workspaceId)
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Workspace not found.");
  return data;
}

export async function createWorkspace(
  supabase: Client,
  user: User,
  input: Database["public"]["Tables"]["workspaces"]["Insert"],
) {
  const { data, error } = await supabase
    .from("workspaces")
    .insert({ ...input, owner_id: user.id })
    .select("id,name,slug,type,description,owner_id,settings,created_at,updated_at")
    .single();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function updateWorkspace(
  supabase: Client,
  workspaceId: string,
  input: Database["public"]["Tables"]["workspaces"]["Update"],
) {
  const { data, error } = await supabase
    .from("workspaces")
    .update(input)
    .eq("id", workspaceId)
    .select("id,name,slug,type,description,owner_id,settings,created_at,updated_at")
    .maybeSingle();

  if (error) throw mapSupabaseError(error);
  if (!data) throw new ApiError(404, "NOT_FOUND", "Workspace not found or not editable.");
  return data;
}

export async function listMembers(supabase: Client, workspaceId: string) {
  const { data, error } = await supabase
    .from("workspace_members")
    .select("id,workspace_id,user_id,role_id,status,joined_at,created_at,updated_at,roles(name,description)")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: true });

  if (error) throw mapSupabaseError(error);
  return data ?? [];
}

export async function addMember(
  supabase: Client,
  workspaceId: string,
  input: { user_id: string; role: string; status: "INVITED" },
) {
  const { data: role, error: roleError } = await supabase
    .from("roles")
    .select("id,name")
    .eq("name", input.role)
    .maybeSingle();

  if (roleError) throw mapSupabaseError(roleError);
  if (!role) throw new ApiError(422, "VALIDATION_ERROR", "Requested role is unavailable.");

  const { data, error } = await supabase
    .from("workspace_members")
    .insert({
      workspace_id: workspaceId,
      user_id: input.user_id,
      role_id: role.id,
      status: input.status,
    })
    .select("id,workspace_id,user_id,role_id,status,joined_at,created_at,updated_at,roles(name,description)")
    .single();

  if (error) throw mapSupabaseError(error);
  return data;
}

export async function updateMember(
  supabase: Client,
  workspaceId: string,
  memberId: string,
  input: { role?: string; status?: "ACTIVE" | "SUSPENDED" | "REMOVED" },
  currentUserId: string,
) {
  const { data: member, error: memberError } = await supabase
    .from("workspace_members")
    .select("id,user_id,role_id,status,roles(name)")
    .eq("workspace_id", workspaceId)
    .eq("id", memberId)
    .maybeSingle();

  if (memberError) throw mapSupabaseError(memberError);
  if (!member) throw new ApiError(404, "NOT_FOUND", "Workspace member not found.");

  const currentRole = Array.isArray(member.roles) ? member.roles[0]?.name : member.roles?.name;
  if (currentRole === "OWNER") {
    throw new ApiError(403, "FORBIDDEN", "The workspace owner cannot be modified through the membership API.");
  }
  if (member.user_id === currentUserId && input.status === "REMOVED") {
    throw new ApiError(409, "CONFLICT", "Self-removal is not supported by this endpoint.");
  }

  let roleId: string | undefined;
  if (input.role) {
    const { data: role, error: roleError } = await supabase
      .from("roles")
      .select("id,name")
      .eq("name", input.role)
      .maybeSingle();
    if (roleError) throw mapSupabaseError(roleError);
    if (!role) throw new ApiError(422, "VALIDATION_ERROR", "Requested role is unavailable.");
    roleId = role.id;
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .update({ ...(roleId ? { role_id: roleId } : {}), ...(input.status ? { status: input.status } : {}) })
    .eq("workspace_id", workspaceId)
    .eq("id", memberId)
    .select("id,workspace_id,user_id,role_id,status,joined_at,created_at,updated_at,roles(name,description)")
    .single();

  if (error) throw mapSupabaseError(error);
  return data;
}

function mapSupabaseError(error: { code?: string; message: string }) {
  if (error.code === "23505") return new ApiError(409, "CONFLICT", "A record with the same unique value already exists.");
  if (error.code === "23503") return new ApiError(422, "VALIDATION_ERROR", "A referenced record does not exist.");
  if (error.code === "23514") return new ApiError(422, "VALIDATION_ERROR", "The supplied value violates a database constraint.");
  if (error.code === "42501") return new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  return new ApiError(500, "INTERNAL_ERROR", error.message);
}
