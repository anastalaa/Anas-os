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
  | "ERROR";

export type OfflineEntity = "task" | "project" | "note" | "document" | "capture";

export type SyncOperation = {
  id: string;
  /** Stable UUID used for server-side idempotency across retries. */
  clientOperationId?: string;
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
  /** Version returned only after the server confirms application. */
  serverVersion?: number;
  attemptCount?: number;
  nextRetryAt?: string | null;
  retryable?: boolean;
  conflictDetails?: Record<string, unknown>;
  error?: string;
};

export type SyncSnapshot = {
  state: SyncState;
  /** Operations that have not yet reached a confirmed SYNCED state. */
  pendingCount: number;
  lastSyncedAt: string | null;
  lastError: string | null;
};
