export const SYNC_STATES = [
  "ONLINE",
  "OFFLINE",
  "SYNCING",
  "SYNCED",
  "CONFLICT",
  "ERROR",
] as const;

export type SyncState = (typeof SYNC_STATES)[number];

export type SyncOperationType = "CREATE" | "UPDATE" | "DELETE";

export type SyncOperationStatus = "PENDING" | "SYNCING" | "SYNCED" | "CONFLICT" | "ERROR";

export type OfflineEntity = "task" | "project" | "note" | "document" | "capture";

export type SyncOperation = {
  id: string;
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
  error?: string;
};

export type SyncSnapshot = {
  state: SyncState;
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};
