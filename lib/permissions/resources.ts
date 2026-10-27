export const RESOURCE_TYPES = [
  "workspace",
  "task",
  "project",
  "note",
  "document",
  "capture",
  "knowledge",
  "culinary",
  "career",
  "learning",
  "finance",
  "family",
  "vehicle",
] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];
