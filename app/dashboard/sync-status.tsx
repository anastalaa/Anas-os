"use client";

import { useSyncStatus } from "@/lib/offline/use-sync-status";
import { triggerSync } from "@/lib/offline/sync-manager";

const labels = {
  ONLINE: "Online",
  OFFLINE: "Offline",
  SYNCING: "Syncing",
  SERVER_PENDING: "Accepted; awaiting server processing",
  SYNCED: "Synced",
  CONFLICT: "Conflict needs review",
  ERROR: "Sync error",
} as const;

export default function SyncStatus({ userId }: { userId: string }) {
  const sync = useSyncStatus(userId);

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
        <span style={{ color: "var(--muted)", marginLeft: 8 }}>{labels[sync.state]}</span>
        {sync.pendingCount > 0 ? (
          <span style={{ color: "var(--muted)", marginLeft: 8 }}>
            · {sync.pendingCount} pending
          </span>
        ) : null}
        {sync.lastError ? (
          <div style={{ color: "var(--danger, #b42318)", fontSize: 13, marginTop: 6 }}>{sync.lastError}</div>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => void triggerSync(userId)}
        disabled={sync.state === "OFFLINE" || sync.state === "SYNCING"}
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "8px 12px",
          background: "var(--surface)",
          color: "var(--foreground)",
          cursor: sync.state === "OFFLINE" || sync.state === "SYNCING" ? "not-allowed" : "pointer",
          opacity: sync.state === "OFFLINE" || sync.state === "SYNCING" ? 0.55 : 1,
        }}
      >
        Sync now
      </button>
    </div>
  );
}
