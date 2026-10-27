import { describe, expect, it } from "vitest";
import { registerDeviceSchema, syncRequestSchema } from "./sync";

describe("sync validation", () => {
  it("accepts a version-aware update operation with an idempotency key", () => {
    const result = syncRequestSchema.safeParse({
      device_id: "00000000-0000-4000-8000-000000000001",
      workspace_id: "00000000-0000-4000-8000-000000000002",
      entity_type: "task",
      entity_id: "00000000-0000-4000-8000-000000000003",
      operation: "UPDATE",
      payload: { title: "Offline update" },
      base_version: 4,
      client_operation_id: "00000000-0000-4000-8000-000000000004",
      client_timestamp: "2026-10-27T09:00:00.000Z",
    });

    expect(result.success).toBe(true);
  });

  it("rejects unsupported entities", () => {
    const result = syncRequestSchema.safeParse({
      device_id: "00000000-0000-4000-8000-000000000001",
      workspace_id: "00000000-0000-4000-8000-000000000002",
      entity_type: "finance",
      entity_id: "00000000-0000-4000-8000-000000000003",
      operation: "UPDATE",
      client_timestamp: "2026-10-27T09:00:00.000Z",
    });

    expect(result.success).toBe(false);
  });

  it("accepts a device registration", () => {
    expect(registerDeviceSchema.safeParse({ device_name: "Anas Fold" }).success).toBe(true);
  });
});
