import { listAllOperations, SYNC_QUEUE_UPDATED_EVENT } from "./idb";
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
let activeUserId: string | null = null;
let workerPromise: Promise<void> | null = null;
let retryTimer: number | null = null;

function emit(next: SyncSnapshot) {
  snapshot = next;
  listeners.forEach((listener) => listener(snapshot));
}

async function refreshQueueSnapshot(userId = activeUserId) {
  if (!userId) return;
  try {
    const operations = await listAllOperations(userId);
    if (activeUserId !== userId) return;
    const pendingCount = operations.filter((operation) =>
      operation.status !== "SYNCED" && operation.status !== "DISCARDED"
    ).length;
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
    if (activeUserId !== userId) return;
    emit({
      ...snapshot,
      state: "ERROR",
      lastError: error instanceof Error ? error.message : "Offline storage is unavailable.",
    });
  }
}

async function scheduleNextRetry(userId: string) {
  if (typeof window === "undefined") return;
  if (retryTimer !== null) {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  if (!navigator.onLine || activeUserId !== userId) return;

  try {
    const operations = await listAllOperations(userId);
    if (activeUserId !== userId) return;
    const retryAt = operations
      .filter((operation) =>
        (operation.status === "ERROR" && operation.retryable === true) ||
        operation.status === "SERVER_PENDING"
      )
      .map((operation) => {
        if (!operation.nextRetryAt) {
          return operation.status === "SERVER_PENDING" ? Date.now() + 1_000 : NaN;
        }
        return Date.parse(operation.nextRetryAt);
      })
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];

    if (retryAt === undefined) return;
    const delay = Math.max(0, Math.min(2_147_000_000, retryAt - Date.now()));
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      startSync(userId);
    }, delay);
  } catch {
    // Queue refresh already exposes storage errors to subscribers.
  }
}

function startSync(requestedUserId = activeUserId) {
  if (
    typeof window === "undefined" ||
    !navigator.onLine ||
    !requestedUserId ||
    activeUserId !== requestedUserId ||
    workerPromise
  ) return;

  const runUserId = requestedUserId;
  emit({ ...snapshot, state: "SYNCING", lastError: null });
  let workerFailed = false;

  workerPromise = runSyncWorker({ userId: runUserId })
    .then(async () => {
      if (activeUserId !== runUserId) return;
      await refreshQueueSnapshot(runUserId);
      await scheduleNextRetry(runUserId);
    })
    .catch((error: unknown) => {
      if (activeUserId !== runUserId) return;
      workerFailed = true;
      emit({
        ...snapshot,
        state: "ERROR",
        lastError: error instanceof Error ? error.message : "Synchronization could not be started.",
      });
    })
    .finally(() => {
      workerPromise = null;
      if (activeUserId !== runUserId) {
        if (activeUserId && typeof navigator !== "undefined" && navigator.onLine) startSync(activeUserId);
        return;
      }
      if (!workerFailed && typeof window !== "undefined" && navigator.onLine) {
        void hasRunnableSyncOperations(runUserId).then((hasRunnable) => {
          if (activeUserId === runUserId && hasRunnable) startSync(runUserId);
        }).catch(() => undefined);
      }
    });
}

function handleOnline() {
  if (activeUserId) {
    emit({ ...snapshot, state: "SYNCING", lastError: null });
    startSync(activeUserId);
  }
}

function handleOffline() {
  if (retryTimer !== null && typeof window !== "undefined") {
    window.clearTimeout(retryTimer);
    retryTimer = null;
  }
  emit({ ...snapshot, state: "OFFLINE" });
}

function handleQueueUpdated(event: Event) {
  const eventUserId = (event as CustomEvent<{ userId?: string }>).detail?.userId;
  if (!eventUserId || eventUserId !== activeUserId) return;
  void refreshQueueSnapshot(eventUserId).then(() => {
    if (typeof navigator !== "undefined" && navigator.onLine) startSync(eventUserId);
  });
}

export function initializeSyncManager(userId: string) {
  if (typeof window === "undefined" || !userId) return;
  if (initialized && activeUserId === userId) return;

  if (initialized) {
    window.removeEventListener("online", handleOnline);
    window.removeEventListener("offline", handleOffline);
    window.removeEventListener(SYNC_QUEUE_UPDATED_EVENT, handleQueueUpdated);
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
  }

  activeUserId = userId;
  snapshot = {
    state: navigator.onLine ? "ONLINE" : "OFFLINE",
    pendingCount: 0,
    lastSyncedAt: null,
    lastError: null,
  };
  initialized = true;
  window.addEventListener("online", handleOnline);
  window.addEventListener("offline", handleOffline);
  window.addEventListener(SYNC_QUEUE_UPDATED_EVENT, handleQueueUpdated);
  void refreshQueueSnapshot(userId).then(() => {
    if (activeUserId === userId && navigator.onLine) startSync(userId);
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

export async function triggerSync(userId: string) {
  initializeSyncManager(userId);
  if (activeUserId !== userId) return;
  if (typeof navigator !== "undefined" && !navigator.onLine) {
    await refreshQueueSnapshot(userId);
    return;
  }

  await retryErroredOperations(userId);
  startSync(userId);
  const activeRun = workerPromise;
  if (activeRun) await activeRun;
  if (activeUserId === userId) {
    await refreshQueueSnapshot(userId);
    await scheduleNextRetry(userId);
  }
}
