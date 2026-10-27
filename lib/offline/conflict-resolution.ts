import type { SyncOperation } from "./types";

export function getConflictServerVersion(operation: SyncOperation): number | null {
  const value =
    operation.conflictDetails?.current_version ??
    operation.conflictDetails?.server_version ??
    operation.serverVersion;
  const version = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(version) && version >= 0 ? version : null;
}

export function buildKeepServerResolution(
  operation: SyncOperation,
  now = new Date().toISOString(),
): SyncOperation {
  if (operation.status !== "CONFLICT") {
    throw new Error("Only conflicted operations can be resolved as Keep Server.");
  }

  return {
    ...operation,
    status: "DISCARDED",
    resolution: "KEEP_SERVER",
    retryable: false,
    error: undefined,
    updatedAt: now,
  };
}

export function buildKeepMineOperations(
  operation: SyncOperation,
  serverVersion: number,
  options: { now?: string; createId?: () => string } = {},
): { resolved: SyncOperation; retry: SyncOperation } {
  if (operation.status !== "CONFLICT") {
    throw new Error("Only conflicted operations can be reapplied.");
  }
  if (!Number.isInteger(serverVersion) || serverVersion < 0) {
    throw new Error("A valid server version is required before reapplying local changes.");
  }

  const now = options.now ?? new Date().toISOString();
  const createId = options.createId ?? (() => {
    if (!globalThis.crypto?.randomUUID) throw new Error("Secure UUID generation is unavailable.");
    return globalThis.crypto.randomUUID();
  });

  const resolved: SyncOperation = {
    ...operation,
    status: "DISCARDED",
    resolution: "KEEP_MINE",
    retryable: false,
    error: undefined,
    updatedAt: now,
  };

  const retry: SyncOperation = {
    ...operation,
    id: createId(),
    clientOperationId: undefined,
    parentOperationId: operation.id,
    resolution: undefined,
    status: "PENDING",
    baseVersion: serverVersion,
    clientVersion: operation.clientVersion + 1,
    createdAt: now,
    updatedAt: now,
    serverVersion: undefined,
    attemptCount: 0,
    nextRetryAt: null,
    retryable: true,
    conflictDetails: undefined,
    error: undefined,
  };

  return { resolved, retry };
}
