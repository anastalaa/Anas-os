import type { SyncOperation } from "./types";

const DB_NAME = "anas-os-offline";
const DB_VERSION = 1;
const STORE_NAME = "sync_operations";
export const SYNC_QUEUE_UPDATED_EVENT = "anas-os:sync-queue-updated";

function openDatabase(userId: string): Promise<IDBDatabase> {
  if (!userId) return Promise.reject(new Error("An authenticated user is required for offline storage."));
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME + "-" + userId, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("workspaceId", "workspaceId", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Unable to open offline database."));
  });
}

function notifyQueueUpdated(userId: string) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(SYNC_QUEUE_UPDATED_EVENT, { detail: { userId } }));
  }
}

function getAllRows(db: IDBDatabase, workspaceId?: string): Promise<SyncOperation[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = workspaceId
      ? tx.objectStore(STORE_NAME).index("workspaceId").getAll(IDBKeyRange.only(workspaceId))
      : tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result as SyncOperation[]);
    request.onerror = () => reject(request.error ?? new Error("Unable to read sync queue."));
  });
}

export async function enqueueOperation(userId: string, operation: SyncOperation): Promise<void> {
  const db = await openDatabase(userId);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put(operation);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Unable to queue sync operation."));
      tx.onabort = () => reject(tx.error ?? new Error("Sync queue update was aborted."));
    });
  } finally {
    db.close();
  }
  notifyQueueUpdated(userId);
}

export async function listPendingOperations(userId: string, workspaceId?: string): Promise<SyncOperation[]> {
  const db = await openDatabase(userId);
  let rows: SyncOperation[];
  try {
    rows = await getAllRows(db, workspaceId);
  } finally {
    db.close();
  }

  const now = Date.now();
  return rows
    .filter((operation) => {
      if (operation.status === "PENDING" || operation.status === "SYNCING") {
        return !operation.nextRetryAt || Date.parse(operation.nextRetryAt) <= now;
      }
      if (operation.status !== "ERROR" || operation.retryable === false) return false;
      return !operation.nextRetryAt || Date.parse(operation.nextRetryAt) <= now;
    })
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function listAllOperations(userId: string, workspaceId?: string): Promise<SyncOperation[]> {
  const db = await openDatabase(userId);
  try {
    const rows = await getAllRows(db, workspaceId);
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

export async function countPendingOperations(userId: string, workspaceId?: string): Promise<number> {
  const operations = await listAllOperations(userId, workspaceId);
  return operations.filter((operation) =>
    operation.status !== "SYNCED" && operation.status !== "DISCARDED"
  ).length;
}

export async function updateOperation(userId: string, operation: SyncOperation): Promise<void> {
  await enqueueOperation(userId, operation);
}

export async function clearOperation(userId: string, id: string): Promise<void> {
  const db = await openDatabase(userId);
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("Unable to remove sync operation."));
      tx.onabort = () => reject(tx.error ?? new Error("Removing a sync operation was aborted."));
    });
  } finally {
    db.close();
  }
  notifyQueueUpdated(userId);
}
