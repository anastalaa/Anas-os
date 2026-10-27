import { countPendingOperations } from "./idb";
import type { SyncSnapshot } from "./types";

export type SyncListener = (snapshot: SyncSnapshot) => void;

let snapshot: SyncSnapshot = {
  state: "ONLINE",
  pendingCount: 0,
  lastSyncedAt: null,
  lastError: null,
};

const listeners = new Set<SyncListener>();
let initialized = false;

function emit(next: SyncSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

async function refreshPendingCount() {
  try {
    const pendingCount = await countPendingOperations();
    emit({ ...snapshot, pendingCount });
  } catch (error) {
    emit({
      ...snapshot,
      state: "ERROR",
      lastError: error instanceof Error ? error.message : "Offline storage is unavailable.",
    });
  }
}

function handleOnline() {
  emit({ ...snapshot, state: snapshot.pendingCount > 0 ? "SYNCING" : "ONLINE", lastError: null });
  void refreshPendingCount().then(() => {
    if (snapshot.pendingCount === 0) {
      emit({ ...snapshot, state: "SYNCED", lastSyncedAt: new Date().toISOString() });
    }
  });
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
  void refreshPendingCount();
}

export function subscribeToSync(listener: SyncListener) {
  listeners.add(listener);
  listener(snapshot);
  return () => listeners.delete(listener);
}

export function getSyncSnapshot() {
  return snapshot;
}

export async function refreshSyncSnapshot() {
  await refreshPendingCount();
}
