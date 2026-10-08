import { describe, expect, it } from "vitest";
import { createTestClock, getCalendarDay, toCalendarDay } from "@softure-ai/core";

describe("toCalendarDay", () => {
  // 23:30 in New York on 31 December is already 1 January in UTC and in Warsaw.
  const lateEvening = new Date("2026-01-01T04:30:00.000Z");

  it("returns the calendar day of an instant in the given zone, not in the process zone", () => {
    expect(toCalendarDay(lateEvening, "America/New_York")).toBe("2025-12-31");
    expect(toCalendarDay(lateEvening, "Europe/Warsaw")).toBe("2026-01-01");
    expect(toCalendarDay(lateEvening, "UTC")).toBe("2026-01-01");
  });

  it("changes the day at local midnight across a DST change", () => {
    // Warsaw moves to summer time on 29 March 2026: midnight that day is 23:00 UTC on the 28th.
    expect(toCalendarDay(new Date("2026-03-28T22:59:59.999Z"), "Europe/Warsaw")).toBe("2026-03-28");
    expect(toCalendarDay(new Date("2026-03-28T23:00:00.000Z"), "Europe/Warsaw")).toBe("2026-03-29");
    // Midnight of 30 March is 22:00 UTC on the 29th, an hour earlier than the night before.
    expect(toCalendarDay(new Date("2026-03-29T21:59:59.999Z"), "Europe/Warsaw")).toBe("2026-03-29");
    expect(toCalendarDay(new Date("2026-03-29T22:00:00.000Z"), "Europe/Warsaw")).toBe("2026-03-30");
  });

  it("pads the year, month and day to YYYY-MM-DD", () => {
    expect(toCalendarDay(new Date("0987-02-03T12:00:00.000Z"), "UTC")).toBe("0987-02-03");
  });

  it("rejects an invalid date, naming the function", () => {
    expect(() => toCalendarDay(new Date("not a date"), "UTC")).toThrow(new RangeError("toCalendarDay: invalid date"));
  });

  it("rejects a name that is not a time zone, naming it", () => {
    expect(() => toCalendarDay(lateEvening, "Mars/Olympus")).toThrow(
      new RangeError('toCalendarDay: "Mars/Olympus" is not an IANA time zone'),
    );
  });
});

describe("getCalendarDay", () => {
  it("returns today in the given zone from the clock", () => {
    const clock = createTestClock(new Date("2026-01-01T04:30:00.000Z"));

    expect(getCalendarDay(clock, "America/New_York")).toBe("2025-12-31");
    expect(getCalendarDay(clock, "Europe/Warsaw")).toBe("2026-01-01");
  });

  it("follows the clock when it moves", () => {
    const clock = createTestClock(new Date("2026-01-01T04:30:00.000Z"));

    clock.advance(30 * 60 * 1000);

    expect(getCalendarDay(clock, "America/New_York")).toBe("2026-01-01");
  });
});
