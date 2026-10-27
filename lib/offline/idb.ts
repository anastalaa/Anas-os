import type { SyncOperation } from "./types";

const DB_NAME = "anas-os-offline";
const DB_VERSION = 1;
const STORE_NAME = "sync_operations";

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

export async function enqueueOperation(operation: SyncOperation): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(operation);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Unable to queue sync operation."));
  });
  db.close();
}

export async function listPendingOperations(workspaceId?: string): Promise<SyncOperation[]> {
  const db = await openDatabase();
  const operations = await new Promise<SyncOperation[]>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = workspaceId
      ? tx.objectStore(STORE_NAME).index("workspaceId").getAll(IDBKeyRange.only(workspaceId))
      : tx.objectStore(STORE_NAME).getAll();

    request.onsuccess = () => {
      const rows = request.result as SyncOperation[];
      resolve(rows.filter((operation) => operation.status === "PENDING" || operation.status === "ERROR"));
    };
    request.onerror = () => reject(request.error ?? new Error("Unable to read sync queue."));
  });
  db.close();
  return operations.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function countPendingOperations(workspaceId?: string): Promise<number> {
  return (await listPendingOperations(workspaceId)).length;
}

export async function updateOperation(operation: SyncOperation): Promise<void> {
  await enqueueOperation(operation);
}

export async function clearOperation(id: string): Promise<void> {
  const db = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("Unable to remove sync operation."));
  });
  db.close();
}
