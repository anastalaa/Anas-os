import type { PermissionAction } from "./actions";
import type { ResourceType } from "./resources";

export type PermissionDecision = {
  allowed: boolean;
  reason:
    | "allowed"
    | "unauthenticated"
    | "not_member"
    | "missing_permission"
    | "sensitive_action_requires_approval";
};

export type PermissionContext = {
  authenticated: boolean;
  isMember: boolean;
  resource: ResourceType;
  action: PermissionAction;
  hasPermission: boolean;
  approvalRequired?: boolean;
};

export function decidePermission(context: PermissionContext): PermissionDecision {
  if (!context.authenticated) {
    return { allowed: false, reason: "unauthenticated" };
  }

  if (!context.isMember) {
    return { allowed: false, reason: "not_member" };
  }

  if (!context.hasPermission) {
    return { allowed: false, reason: "missing_permission" };
  }

  if (context.approvalRequired) {
    return { allowed: false, reason: "sensitive_action_requires_approval" };
  }

  return { allowed: true, reason: "allowed" };
}
