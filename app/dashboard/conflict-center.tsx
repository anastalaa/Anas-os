"use client";

import { useState } from "react";
import { triggerSync } from "@/lib/offline/sync-manager";
import {
  buildKeepMineOperations,
  buildKeepServerResolution,
  getConflictServerVersion,
} from "@/lib/offline/conflict-resolution";
import { updateOperation } from "@/lib/offline/idb";
import { retrySyncOperation } from "@/lib/offline/sync-worker";
import { useSyncOperations } from "@/lib/offline/use-sync-operations";
import type { SyncOperation } from "@/lib/offline/types";

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function ConflictCenter() {
  const operations = useSyncOperations();
  const [actionError, setActionError] = useState<string | null>(null);
  const unresolved = operations.filter((operation) =>
    operation.status === "CONFLICT" ||
    operation.status === "ERROR" ||
    operation.status === "SERVER_PENDING"
  );

  async function keepServer(operation: SyncOperation) {
    try {
      setActionError(null);
      await updateOperation(buildKeepServerResolution(operation));
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not resolve this conflict.");
    }
  }

  async function keepMine(operation: SyncOperation) {
    try {
      setActionError(null);
      const serverVersion = getConflictServerVersion(operation);
      if (serverVersion === null) {
        throw new Error("The server version is unavailable. Refresh the conflict before reapplying local changes.");
      }

      const result = buildKeepMineOperations(operation, serverVersion);
      // Persist the new intent first; keep the original operation as local resolution history.
      await updateOperation(result.retry);
      await updateOperation(result.resolved);
      await triggerSync();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not reapply the local changes.");
    }
  }

  async function retryError(operation: SyncOperation) {
    try {
      setActionError(null);
      await retrySyncOperation(operation);
      await triggerSync();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not retry this operation.");
    }
  }

  return (
    <section
      aria-labelledby="sync-conflict-heading"
      style={{
        marginTop: 24,
        padding: 20,
        border: "1px solid var(--border)",
        borderRadius: 16,
        background: "var(--surface)",
      }}
    >
      <h2 id="sync-conflict-heading" style={{ marginTop: 0 }}>Sync Review Center</h2>
      <p style={{ color: "var(--muted)", lineHeight: 1.5 }}>
        Conflicts stay on this device until you resolve them. Reapplying local changes uses the latest known server version, which the server checks again before writing.
      </p>

      {actionError ? <p role="alert" style={{ color: "var(--danger, #b42318)" }}>{actionError}</p> : null}

      {unresolved.length === 0 ? (
        <p style={{ color: "var(--muted)", marginBottom: 0 }}>No unresolved sync conflicts or errors.</p>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          {unresolved.map((operation) => {
            const serverVersion = getConflictServerVersion(operation);
            return (
              <article
                key={operation.id}
                style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 16 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <strong>{operation.entity} · {operation.operation}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 13 }}>{operation.status.replace("_", " ")}</span>
                </div>
                <p style={{ margin: "8px 0", overflowWrap: "anywhere" }}>
                  Record: <code>{operation.entityId}</code>
                </p>
                <p style={{ color: "var(--muted)", margin: "6px 0", fontSize: 13 }}>
                  Queued {formatDate(operation.createdAt)}
                  {serverVersion !== null ? " · server version " + serverVersion : ""}
                </p>
                {operation.error ? <p role="alert" style={{ color: "var(--danger, #b42318)" }}>{operation.error}</p> : null}

                {operation.conflictDetails ? (
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ cursor: "pointer" }}>Review conflict details</summary>
                    <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: 12 }}>
                      {JSON.stringify(operation.conflictDetails, null, 2)}
                    </pre>
                  </details>
                ) : null}

                {operation.status === "CONFLICT" ? (
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                    <button type="button" onClick={() => void keepServer(operation)}>
                      Keep server version
                    </button>
                    <button
                      type="button"
                      onClick={() => void keepMine(operation)}
                      disabled={serverVersion === null}
                    >
                      Reapply my changes
                    </button>
                  </div>
                ) : null}

                {operation.status === "ERROR" && operation.entity !== "capture" ? (
                  <button type="button" onClick={() => void retryError(operation)} style={{ marginTop: 12 }}>
                    Retry this operation
                  </button>
                ) : null}

                {operation.status === "SERVER_PENDING" ? (
                  <p style={{ color: "var(--muted)", marginBottom: 0 }}>
                    The server accepted this operation, but has not confirmed final processing. The local operation is preserved.
                  </p>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
