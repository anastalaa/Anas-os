"use client";

import { useSyncStatus } from "@/lib/offline/use-sync-status";

const labels = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  SYNCING: "Syncing",
  SERVER_PENDING: "Accepted; awaiting server processing",
  SYNCED: "Synced",
  CONFLICT: "Conflict needs review",
  ERROR: "Sync error",
} as const;

export default function SyncStatus() {
  const sync = useSyncStatus();
  const label = labels[sync.state];

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "14px 16px",
        marginTop: 24,
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 14,
      }}
    >
      <div>
        <strong>Sync</strong>
        <span style={{ color: "var(--muted)", marginLeft: 8 }}>{label}</span>
        {sync.pendingCount > 0 ? (
          <span style={{ color: "var(--muted)", marginLeft: 8 }}>
            · {sync.pendingCount} pending
          </span>
        ) : null}
      </div>
      {sync.lastError ? (
        <span style={{ color: "var(--danger, #b42318)", fontSize: 13 }}>{sync.lastError}</span>
      ) : null}
    </div>
  );
}
