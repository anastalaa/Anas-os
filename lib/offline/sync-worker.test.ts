import { describe, expect, it } from "vitest";
import { calculateRetryDelayMs } from "./sync-worker";

describe("sync worker retry policy", () => {
  it("uses exponential backoff for transient failures", () => {
    expect(calculateRetryDelayMs(1)).toBe(1_000);
    expect(calculateRetryDelayMs(2)).toBe(2_000);
    expect(calculateRetryDelayMs(5)).toBe(16_000);
  });

  it("caps the retry delay and normalizes invalid attempt counts", () => {
    expect(calculateRetryDelayMs(0)).toBe(1_000);
    expect(calculateRetryDelayMs(100)).toBe(256_000);
  });
});
