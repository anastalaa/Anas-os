import { describe, expect, it } from "vitest";
import {
  buildKeepMineOperations,
  buildKeepServerResolution,
  getConflictServerVersion,
} from "./conflict-resolution";
import type { SyncOperation } from "./types";

const conflictedOperation: SyncOperation = {
  id: "local-op-1",
  clientOperationId: "00000000-0000-4000-8000-000000000001",
  workspaceId: "workspace-1",
  entity: "task",
  entityId: "task-1",
  operation: "UPDATE",
  payload: { title: "Local title" },
  baseVersion: 3,
  clientVersion: 4,
  status: "CONFLICT",
  createdAt: "2026-10-27T10:00:00.000Z",
  updatedAt: "2026-10-27T10:00:00.000Z",
  conflictDetails: { current_version: 5 },
  error: "Version conflict",
};

describe("offline conflict resolution", () => {
  it("reads the server version from conflict details", () => {
    expect(getConflictServerVersion(conflictedOperation)).toBe(5);
  });

  it("keeps the original payload when the user chooses to keep server", () => {
    const resolved = buildKeepServerResolution(conflictedOperation, "2026-10-27T11:00:00.000Z");
    expect(resolved.status).toBe("DISCARDED");
    expect(resolved.resolution).toBe("KEEP_SERVER");
    expect(resolved.payload).toEqual({ title: "Local title" });
  });

  it("creates a separate reapplication with a fresh id and server base version", () => {
    const result = buildKeepMineOperations(conflictedOperation, 5, {
      now: "2026-10-27T11:00:00.000Z",
      createId: () => "local-op-2",
    });

    expect(result.resolved.status).toBe("DISCARDED");
    expect(result.resolved.resolution).toBe("KEEP_MINE");
    expect(result.retry.id).toBe("local-op-2");
    expect(result.retry.parentOperationId).toBe("local-op-1");
    expect(result.retry.clientOperationId).toBeUndefined();
    expect(result.retry.baseVersion).toBe(5);
    expect(result.retry.status).toBe("PENDING");
    expect(result.retry.payload).toEqual({ title: "Local title" });
  });

  it("refuses to reapply without a valid server version", () => {
    expect(() => buildKeepMineOperations(conflictedOperation, -1)).toThrow();
  });
});
