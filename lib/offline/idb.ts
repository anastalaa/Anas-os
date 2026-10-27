import type { SyncOperation } from "./types";

const DB_NAME = "anas-os-offline";
const DB_VERSION = 1;
const STORE_NAME = "sync_operations";
export const SYNC_QUEUE_UPDATED_EVENT = "anas-os:sync-queue-updated";

function openDatabase(): Promise<IDBDatabase> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.reject(new Error("IndexedDB is not available in this environment."));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

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

function notifyQueueUpdated() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_QUEUE_UPDATED_EVENT));
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

export async function enqueueOperation(operation: SyncOperation): Promise<void> {
  const db = await openDatabase();
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
  notifyQueueUpdated();
}

/** Returns operations ready to upload, including interrupted work from a prior session. */
export async function listPendingOperations(workspaceId?: string): Promise<SyncOperation[]> {
  const db = await openDatabase();
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

/** Includes server-pending and conflicted records so the UI cannot report a false clean sync. */
export async function listAllOperations(workspaceId?: string): Promise<SyncOperation[]> {
  const db = await openDatabase();
  try {
    const rows = await getAllRows(db, workspaceId);
    return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  } finally {
    db.close();
  }
}

export async function countPendingOperations(workspaceId?: string): Promise<number> {
  const operations = await listAllOperations(workspaceId);
  return operations.filter((operation) => operation.status !== "SYNCED").length;
}

export async function updateOperation(operation: SyncOperation): Promise<void> {
  await enqueueOperation(operation);
}

export async function clearOperation(id: string): Promise<void> {
  const db = await openDatabase();
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
  notifyQueueUpdated();
}
