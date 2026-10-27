import {
  listAllOperations,
  SYNC_QUEUE_UPDATED_EVENT,
} from "./idb";
import { hasRunnableSyncOperations, retryErroredOperations, runSyncWorker } from "./sync-worker";
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
let retryTimer: number | null = null;

function emit(next: SyncSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

async function refreshQueueSnapshot() {
  try {
    const operations = await listAllOperations();
    const pendingCount = operations.filter((operation) => operation.status !== "SYNCED" && operation.status !== "DISCARDED").length;
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
    const latestConfirmedSync = operations
      .filter((operation) => operation.status === "SYNCED")
      .map((operation) => operation.updatedAt)
      .sort()
      .at(-1);
    const lastSyncedAt =
      latestConfirmedSync && (!snapshot.lastSyncedAt || latestConfirmedSync > snapshot.lastSyncedAt)
        ? latestConfirmedSync
        : snapshot.lastSyncedAt;

    emit({
      ...snapshot,
      state,
      pendingCount,
      lastSyncedAt,
      lastError: unresolvedError?.error ?? (
        state === "SERVER_PENDING"
          ? "The server accepted operations; final processing is still pending."
          : null
      ),
    });
  } catch (error) {
    emit({
      ...snapshot,
      state: "ERROR",
      lastError: error instanceof Error ? error.message : "Offline storage is unavailable.",
    });
  }
}

async function scheduleNextRetry() {
  if (typeof window === "undefined") return;
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (!navigator.onLine) return;

  try {
    const operations = await listAllOperations();
    const retryAt = operations
      .filter((operation) => operation.status === "ERROR" && operation.retryable === true && operation.nextRetryAt)
      .map((operation) => Date.parse(operation.nextRetryAt as string))
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];

    if (retryAt === undefined) return;
    const delay = Math.max(0, Math.min(2_147_000_000, retryAt - Date.now()));
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      startSync();
    }, delay);
  } catch {
    // Queue refresh already exposes storage errors to subscribers.
  }
}

function startSync() {
  if (typeof window === "undefined" || !navigator.onLine || workerPromise) return;
  emit({ ...snapshot, state: "SYNCING", lastError: null });
  let workerFailed = false;
  workerPromise = runSyncWorker()
    .then(() => refreshQueueSnapshot())
    .then(() => scheduleNextRetry())
    .catch((error: unknown) => {
      workerFailed = true;
      emit({
        ...snapshot,
        state: "ERROR",
        lastError: error instanceof Error ? error.message : "Synchronization could not be started.",
      });
    })
    .finally(() => {
      workerPromise = null;
      if (!workerFailed && typeof window !== "undefined" && navigator.onLine) {
        // Continue batches only if runnable work remains; blocked items must not create a tight loop.
        void hasRunnableSyncOperations().then((hasRunnable) => {
          if (hasRunnable) startSync();
        }).catch(() => undefined);
      }
    });
}

function handleOnline() {
  emit({ ...snapshot, state: "SYNCING", lastError: null });
  startSync();
}

function handleOffline() {
  if (retryTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  emit({ ...snapshot, state: "OFFLINE" });
}

function handleQueueUpdated() {
  void refreshQueueSnapshot().then(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) startSync();
  });
}

export function initializeSyncManager() {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  snapshot = { ...snapshot, state: navigator.onLine ? "ONLINE" : "OFFLINE" };
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  window.addEventListener(SYNC_QUEUE_UPDATED_EVENT, handleQueueUpdated);
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
  // A user-initiated sync explicitly retries failed non-capture operations.
  await retryErroredOperations();
  startSync();
  if (workerPromise) await workerPromise;
  await refreshQueueSnapshot();
  await scheduleNextRetry();
}
