import { describe, expect, it } from "vitest";
import { decidePermission } from "./decision";

describe("decidePermission", () => {
  const base = {
    authenticated: true,
    isMember: true,
    resource: "task" as const,
    action: "VIEW" as const,
    hasPermission: true,
  };

  it("allows an authenticated member with permission", () => {
    expect(decidePermission(base)).toEqual({
      allowed: true,
      reason: "allowed",
    });
  });

  it("rejects unauthenticated access first", () => {
    expect(decidePermission({ ...base, authenticated: false })).toEqual({
      allowed: false,
      reason: "unauthenticated",
    });
  });

  it("rejects non-members", () => {
    expect(decidePermission({ ...base, isMember: false })).toEqual({
      allowed: false,
      reason: "not_member",
    });
  });

  it("rejects missing permissions", () => {
    expect(decidePermission({ ...base, hasPermission: false })).toEqual({
      allowed: false,
      reason: "missing_permission",
    });
  });

  it("blocks actions awaiting approval", () => {
    expect(decidePermission({ ...base, approvalRequired: true })).toEqual({
      allowed: false,
      reason: "sensitive_action_requires_approval",
    });
  });
});
