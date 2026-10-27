import type { PermissionAction } from "@/lib/permissions/actions";
import type { ResourceType } from "@/lib/permissions/resources";
import { ApiError } from "./errors";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function requireWorkspacePermission(
  supabase: SupabaseClient,
  workspaceId: string,
  resource: ResourceType,
  action: PermissionAction,
) {
  const { data, error } = await supabase.rpc("has_workspace_permission", {
    target_workspace: workspaceId,
    target_resource: resource,
    target_action: action,
  });

  if (error) {
    throw new ApiError(500, "INTERNAL_ERROR", "Workspace authorization could not be evaluated.");
  }

  if (!data) {
    throw new ApiError(403, "FORBIDDEN", "You do not have permission to perform this action.");
  }
}

export async function requireWorkspaceMembership(
  supabase: SupabaseClient,
  workspaceId: string,
) {
  const { data, error } = await supabase.rpc("is_workspace_member", {
    target_workspace: workspaceId,
  });

  if (error) {
    throw new ApiError(500, "INTERNAL_ERROR", "Workspace access could not be evaluated.");
  }

  if (!data) {
    throw new ApiError(403, "FORBIDDEN", "You are not an active member of this workspace.");
  }
}
