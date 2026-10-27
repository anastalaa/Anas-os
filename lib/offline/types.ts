export const SYNC_STATES = [
  "ONLINE",
  "OFFLINE",
  "SYNCING",
  "SERVER_PENDING",
  "SYNCED",
  "CONFLICT",
  "ERROR",
] as const;

export type SyncState = (typeof SYNC_STATES)[number];
export type SyncOperationType = "CREATE" | "UPDATE" | "DELETE";
export type SyncOperationStatus =
  | "PENDING"
  | "SYNCING"
  | "SERVER_PENDING"
  | "SYNCED"
  | "CONFLICT"
  | "ERROR"
  | "DISCARDED";

export type ConflictResolution = "KEEP_SERVER" | "KEEP_MINE";
export type OfflineEntity = "task" | "project" | "note" | "document" | "capture";

export type SyncOperation = {
  id: string;
  clientOperationId?: string;
  parentOperationId?: string;
  resolution?: ConflictResolution;
  workspaceId: string;
  entity: OfflineEntity;
  entityId: string;
  operation: SyncOperationType;
  payload: Record<string, unknown>;
  baseVersion: number | null;
  clientVersion: number;
  status: SyncOperationStatus;
  createdAt: string;
  updatedAt: string;
  serverVersion?: number;
  attemptCount?: number;
  nextRetryAt?: string | null;
  retryable?: boolean;
  conflictDetails?: Record<string, unknown>;
  error?: string;
};

export type SyncSnapshot = {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};
