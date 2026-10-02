import { describe, expect, it } from "vitest";
import { createTestClock, systemClock } from "@softure-ai/core";

describe("systemClock", () => {
  it("returns the current time", () => {
    const before = Date.now();
    const now = systemClock.now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe("createTestClock", () => {
  const start = new Date("2026-03-29T00:30:00.000Z");

  it("starts at the given instant", () => {
    expect(createTestClock(start).now().toISOString()).toBe("2026-03-29T00:30:00.000Z");
  });

  it("moves forward by the given milliseconds", () => {
    const clock = createTestClock(start);
    clock.advance(90 * 60 * 1000);
    expect(clock.now().toISOString()).toBe("2026-03-29T02:00:00.000Z");
  });

  it("jumps to a set instant", () => {
    const clock = createTestClock(start);
    clock.set(new Date("2027-01-01T00:00:00.000Z"));
    expect(clock.now().toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("is not changed by mutating a returned date or the start date", () => {
    const input = new Date(start);
    const clock = createTestClock(input);
    clock.now().setUTCFullYear(1999);
    input.setUTCFullYear(1999);
    expect(clock.now().toISOString()).toBe("2026-03-29T00:30:00.000Z");
  });

  it("rejects an invalid date", () => {
    expect(() => createTestClock(new Date("not a date"))).toThrow("createTestClock: invalid start date");
  });
});
