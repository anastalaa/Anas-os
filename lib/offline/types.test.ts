import { describe, expect, it } from "vitest";
import { SYNC_STATES, type SyncOperation } from "./types";

describe("offline sync contracts", () => {
  it("defines all supported sync states", () => {
    expect(SYNC_STATES).toEqual([
      "ONLINE",
      "OFFLINE",
      "SYNCING",
      "SERVER_PENDING",
      "SYNCED",
      "CONFLICT",
      "ERROR",
    ]);
  });

  it("supports version-aware queued operations", () => {
    const operation: SyncOperation = {
      id: "op-1",
      clientOperationId: "00000000-0000-4000-8000-000000000004",
      workspaceId: "workspace-1",
      entity: "task",
      entityId: "task-1",
      operation: "UPDATE",
      payload: { title: "Updated task" },
      baseVersion: 4,
      clientVersion: 5,
      status: "PENDING",
      createdAt: "2026-10-27T00:00:00.000Z",
      updatedAt: "2026-10-27T00:00:00.000Z",
    };

    expect(operation.baseVersion).toBe(4);
    expect(operation.clientVersion).toBe(5);
    expect(operation.status).toBe("PENDING");
    expect(operation.clientOperationId).toMatch(/^[0-9a-f-]{36}$/i);
  });
});
