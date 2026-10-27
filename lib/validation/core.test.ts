import { describe, expect, it } from "vitest";
import { noteCreateSchema, projectCreateSchema, taskCreateSchema } from "./core";

describe("core validation", () => {
  it("accepts a minimal task", () => {
    expect(taskCreateSchema.safeParse({ title: "Plan tomorrow" }).success).toBe(true);
  });

  it("rejects an empty task title", () => {
    expect(taskCreateSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("accepts a project with dates", () => {
    expect(projectCreateSchema.safeParse({ name: "Kitchen Lab", start_date: "2026-10-27", target_date: "2026-11-10" }).success).toBe(true);
  });

  it("rejects an invalid project date", () => {
    expect(projectCreateSchema.safeParse({ name: "Kitchen Lab", start_date: "27-10-2026" }).success).toBe(false);
  });

  it("accepts structured note content", () => {
    expect(noteCreateSchema.safeParse({ title: "Idea", content: { blocks: [] } }).success).toBe(true);
  });
});
