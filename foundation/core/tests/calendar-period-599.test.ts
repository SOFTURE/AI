import { describe, expect, expectTypeOf, it } from "vitest";
import { z } from "zod";
import {
  calendarPeriodSchema,
  countPeriodDays,
  doPeriodsOverlap,
  isDayInPeriod,
  type CalendarPeriod,
} from "@softure-ai/core";

const DECEMBER: CalendarPeriod = { from: "2026-12-01", to: "2026-12-31" };

describe("calendarPeriodSchema", () => {
  it("accepts a period whose ends are equal or in order", () => {
    expect(calendarPeriodSchema.parse({ from: "2026-12-01", to: "2026-12-01" })).toEqual({ from: "2026-12-01", to: "2026-12-01" });
    expect(calendarPeriodSchema.parse(DECEMBER)).toEqual(DECEMBER);
  });

  it("refuses `to` before `from` with one issue on the path to", () => {
    const result = calendarPeriodSchema.safeParse({ from: "2026-12-02", to: "2026-12-01" });
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => ({ path: issue.path, message: issue.message }))).toEqual([
      { path: ["to"], message: "must not come before from" },
    ]);
  });

  it("refuses a malformed day with one issue on that end only", () => {
    const result = calendarPeriodSchema.safeParse({ from: "2026-02-30", to: "2026-01-01" });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["from"]]);
    expect(calendarPeriodSchema.safeParse({ from: "2026-12-01" }).success).toBe(false);
    expect(calendarPeriodSchema.safeParse("2026-12-01").success).toBe(false);
  });

  it("parses into a CalendarPeriod", () => {
    expectTypeOf<z.infer<typeof calendarPeriodSchema>>().toExtend<CalendarPeriod>();
  });
});

describe("isDayInPeriod", () => {
  it("includes both ends", () => {
    expect(isDayInPeriod("2026-12-01", DECEMBER)).toBe(true);
    expect(isDayInPeriod("2026-12-15", DECEMBER)).toBe(true);
    expect(isDayInPeriod("2026-12-31", DECEMBER)).toBe(true);
  });

  it("excludes the days around it", () => {
    expect(isDayInPeriod("2026-11-30", DECEMBER)).toBe(false);
    expect(isDayInPeriod("2027-01-01", DECEMBER)).toBe(false);
  });

  it("throws a RangeError for a malformed day or period", () => {
    expect(() => isDayInPeriod("2026-12-1", DECEMBER)).toThrow(new RangeError('isDayInPeriod: "2026-12-1" is not a YYYY-MM-DD calendar day'));
    expect(() => isDayInPeriod("2026-12-01", { from: "2026-12-31", to: "2026-12-01" })).toThrow(
      new RangeError('isDayInPeriod: the period ends ("2026-12-01") before it starts ("2026-12-31")'),
    );
  });
});

describe("doPeriodsOverlap", () => {
  it("counts one shared day as an overlap", () => {
    expect(doPeriodsOverlap(DECEMBER, { from: "2026-12-31", to: "2027-01-05" })).toBe(true);
    expect(doPeriodsOverlap({ from: "2026-11-20", to: "2026-12-01" }, DECEMBER)).toBe(true);
  });

  it("does not count adjacent periods", () => {
    expect(doPeriodsOverlap(DECEMBER, { from: "2027-01-01", to: "2027-01-31" })).toBe(false);
    expect(doPeriodsOverlap({ from: "2026-11-01", to: "2026-11-30" }, DECEMBER)).toBe(false);
  });

  it("covers containment and is symmetric", () => {
    const week = { from: "2026-12-07", to: "2026-12-13" };
    expect(doPeriodsOverlap(DECEMBER, week)).toBe(true);
    expect(doPeriodsOverlap(week, DECEMBER)).toBe(true);
    expect(doPeriodsOverlap(DECEMBER, DECEMBER)).toBe(true);
  });

  it("throws a RangeError for a malformed period", () => {
    expect(() => doPeriodsOverlap(DECEMBER, { from: "2026-13-01", to: "2026-12-31" })).toThrow(
      new RangeError('doPeriodsOverlap: "2026-13-01" is not a YYYY-MM-DD calendar day'),
    );
  });
});

describe("countPeriodDays", () => {
  it("counts both ends", () => {
    expect(countPeriodDays({ from: "2026-12-01", to: "2026-12-01" })).toBe(1);
    expect(countPeriodDays(DECEMBER)).toBe(31);
    expect(countPeriodDays({ from: "2028-02-01", to: "2028-02-29" })).toBe(29);
    expect(countPeriodDays({ from: "2028-01-01", to: "2028-12-31" })).toBe(366);
  });

  it("counts a period across a DST change by days, not hours", () => {
    expect(countPeriodDays({ from: "2026-03-07", to: "2026-03-09" })).toBe(3);
  });

  it("throws a RangeError for a period that ends before it starts", () => {
    expect(() => countPeriodDays({ from: "2026-12-02", to: "2026-12-01" })).toThrow(
      new RangeError('countPeriodDays: the period ends ("2026-12-01") before it starts ("2026-12-02")'),
    );
  });
});
