export const PERMISSION_ACTIONS = [
  "VIEW",
  "COMMENT",
  "CREATE",
  "EDIT",
  "DELETE",
  "EXPORT",
  "SHARE",
  "ADMIN",
] as const;

export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const SENSITIVE_ACTIONS = new Set<PermissionAction>([
  "DELETE",
  "EXPORT",
  "SHARE",
  "ADMIN",
]);

export function isSensitiveAction(action: PermissionAction) {
  return SENSITIVE_ACTIONS.has(action);
}
