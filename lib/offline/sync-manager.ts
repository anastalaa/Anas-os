import { listAllOperations } from "./idb";
import { runSyncWorker } from "./sync-worker";
import type { SyncSnapshot, SyncState } from "./types";

export type SyncListener = (snapshot: SyncSnapshot) => void;

let snapshot: SyncSnapshot = {
  state: "ONLINE",
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
};

const listeners = new Set<SyncListener>();
let initialized = false;
let workerPromise: Promise<void> | null = null;

function emit(next: SyncSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

async function refreshQueueSnapshot() {
  try {
    const operations = await listAllOperations();
    const pendingCount = operations.filter((operation) => operation.status !== "SYNCED").length;
    const online = typeof navigator === "undefined" || navigator.onLine;
    let state: SyncState;

    if (!online) state = "OFFLINE";
    else if (operations.some((operation) => operation.status === "CONFLICT")) state = "CONFLICT";
    else if (operations.some((operation) => operation.status === "ERROR")) state = "ERROR";
    else if (operations.some((operation) => operation.status === "SERVER_PENDING")) state = "SERVER_PENDING";
    else if (operations.some((operation) => operation.status === "PENDING" || operation.status === "SYNCING")) state = "SYNCING";
    else if (pendingCount === 0 && snapshot.lastSyncedAt) state = "SYNCED";
    else state = "ONLINE";

    const unresolvedError = operations.find((operation) => operation.status === "ERROR" || operation.status === "CONFLICT");
    emit({
      ...snapshot,
      state,
      pendingCount,
      lastError: unresolvedError?.error ?? (state === "SERVER_PENDING" ? "The server accepted operations; final processing is still pending." : null),
      ...(operations.some((operation) => operation.status === "SYNCED")
        ? { lastSyncedAt: snapshot.lastSyncedAt ?? new Date().toISOString() }
        : {}),
    });
  } catch (error) {
    emit({
      ...snapshot,
      state: "ERROR",
      lastError: error instanceof Error ? error.message : "Offline storage is unavailable.",
    });
  }
}

function startSync() {
  if (typeof window === "undefined" || !navigator.onLine || workerPromise) return;
  emit({ ...snapshot, state: "SYNCING", lastError: null });
  workerPromise = runSyncWorker()
    .then(() => refreshQueueSnapshot())
    .catch((error: unknown) => {
      emit({
        ...snapshot,
        state: "ERROR",
        lastError: error instanceof Error ? error.message : "Synchronization could not be started.",
      });
    })
    .finally(() => {
      workerPromise = null;
    });
}

function handleOnline() {
  emit({ ...snapshot, state: "SYNCING", lastError: null });
  startSync();
}

function handleOffline() {
  emit({ ...snapshot, state: "OFFLINE" });
}

export function initializeSyncManager() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  snapshot = { ...snapshot, state: navigator.onLine ? "ONLINE" : "OFFLINE" };
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  void refreshQueueSnapshot().then(() => {
    if (navigator.onLine) startSync();
  });
}

export function subscribeToSync(listener: SyncListener) {
  listeners.add(listener);
  listener(snapshot);
  return () => {
    listeners.delete(listener);
  };
}

export function getSyncSnapshot() {
  return snapshot;
}

export async function refreshSyncSnapshot() {
  await refreshQueueSnapshot();
}

export async function triggerSync() {
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await refreshQueueSnapshot();
    return;
  }
  startSync();
  if (workerPromise) await workerPromise;
  await refreshQueueSnapshot();
}
