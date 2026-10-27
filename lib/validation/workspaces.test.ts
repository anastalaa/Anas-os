import { describe, expect, it } from "vitest";
import { addWorkspaceMemberSchema, createWorkspaceSchema, updateWorkspaceSchema } from "./workspaces";

describe("workspace schemas", () => {
  it("accepts a valid workspace", () => {
    expect(
      createWorkspaceSchema.safeParse({
        name: "Personal OS",
        slug: "personal-os",
        type: "PERSONAL",
      }).success,
    ).toBe(true);
  });

  it("rejects unsafe slugs", () => {
    expect(
      createWorkspaceSchema.safeParse({
        name: "Personal OS",
        slug: "Personal OS!",
        type: "PERSONAL",
      }).success,
    ).toBe(false);
  });

  it("requires at least one workspace update field", () => {
    expect(updateWorkspaceSchema.safeParse({}).success).toBe(false);
  });

  it("does not allow assigning OWNER through the member API", () => {
    expect(
      addWorkspaceMemberSchema.safeParse({
        user_id: "00000000-0000-0000-0000-000000000001",
        role: "OWNER",
      }).success,
    ).toBe(false);
  });
});
