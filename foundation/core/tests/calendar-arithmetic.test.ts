import { describe, expect, it } from "vitest";
import { addCalendarDays, addCalendarMonths, calendarDaysBetween, isCalendarDay, wholeMonthsBetween } from "@softure-ai/core";

describe("isCalendarDay", () => {
  it("accepts a real YYYY-MM-DD day, leap days included", () => {
    expect(isCalendarDay("2026-10-09")).toBe(true);
    expect(isCalendarDay("2028-02-29")).toBe(true);
    expect(isCalendarDay("0001-01-01")).toBe(true);
    expect(isCalendarDay("9999-12-31")).toBe(true);
  });

  it("refuses a day the calendar lacks, another shape and other types", () => {
    expect(isCalendarDay("2026-02-29")).toBe(false);
    expect(isCalendarDay("2026-02-30")).toBe(false);
    expect(isCalendarDay("2026-13-01")).toBe(false);
    expect(isCalendarDay("2026-00-10")).toBe(false);
    expect(isCalendarDay("2026-1-1")).toBe(false);
    expect(isCalendarDay("2026-10-09T00:00:00Z")).toBe(false);
    expect(isCalendarDay("")).toBe(false);
    expect(isCalendarDay(20261009)).toBe(false);
    expect(isCalendarDay(null)).toBe(false);
  });
});

describe("addCalendarDays", () => {
  it("adds and subtracts days across month, year and leap-day boundaries", () => {
    expect(addCalendarDays("2026-10-09", 0)).toBe("2026-10-09");
    expect(addCalendarDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addCalendarDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addCalendarDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addCalendarDays("2026-01-01", 365)).toBe("2027-01-01");
  });

  it("ignores DST: a day is a calendar day, not 24 hours", () => {
    // Warsaw's day of 29 March 2026 has 23 hours; the next calendar day is still the 30th.
    expect(addCalendarDays("2026-03-29", 1)).toBe("2026-03-30");
  });

  it("rejects a malformed day, a fractional count and a result past year 9999", () => {
    expect(() => addCalendarDays("2026-02-30", 1)).toThrow(new RangeError('addCalendarDays: "2026-02-30" is not a YYYY-MM-DD calendar day'));
    expect(() => addCalendarDays("2026-10-09", 1.5)).toThrow(new RangeError("addCalendarDays: 1.5 is not a whole number of days"));
    expect(() => addCalendarDays("9999-12-31", 1)).toThrow(RangeError);
  });
});

describe("addCalendarMonths", () => {
  it("keeps the day of month when the target month has it", () => {
    expect(addCalendarMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addCalendarMonths("2026-11-30", 2)).toBe("2027-01-30");
    expect(addCalendarMonths("2026-03-31", -1)).toBe("2026-02-28");
    expect(addCalendarMonths("2026-10-09", 0)).toBe("2026-10-09");
    expect(addCalendarMonths("2026-10-09", -12)).toBe("2025-10-09");
  });

  it("clamps a missing day to the month end by default", () => {
    expect(addCalendarMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addCalendarMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addCalendarMonths("2026-05-31", 1, { endOfMonth: "clamp" })).toBe("2026-06-30");
    expect(addCalendarMonths("2028-02-29", 12)).toBe("2029-02-28");
  });

  it("overflows a missing day into the next month on request", () => {
    expect(addCalendarMonths("2026-01-31", 1, { endOfMonth: "overflow" })).toBe("2026-03-03");
    expect(addCalendarMonths("2028-01-31", 1, { endOfMonth: "overflow" })).toBe("2028-03-02");
    expect(addCalendarMonths("2026-01-15", 1, { endOfMonth: "overflow" })).toBe("2026-02-15");
  });

  it("rejects a malformed day and a fractional count", () => {
    expect(() => addCalendarMonths("2026-1-31", 1)).toThrow(new RangeError('addCalendarMonths: "2026-1-31" is not a YYYY-MM-DD calendar day'));
    expect(() => addCalendarMonths("2026-01-31", 0.5)).toThrow(new RangeError("addCalendarMonths: 0.5 is not a whole number of months"));
  });
});

describe("calendarDaysBetween", () => {
  it("counts calendar days from the first day to the second, negative backwards", () => {
    expect(calendarDaysBetween("2026-10-09", "2026-10-09")).toBe(0);
    expect(calendarDaysBetween("2026-10-09", "2026-10-10")).toBe(1);
    expect(calendarDaysBetween("2026-10-10", "2026-10-09")).toBe(-1);
    expect(calendarDaysBetween("2028-02-01", "2028-03-01")).toBe(29);
    expect(calendarDaysBetween("2026-03-28", "2026-03-30")).toBe(2);
  });

  it("rejects a malformed day", () => {
    expect(() => calendarDaysBetween("2026-10-09", "tomorrow")).toThrow(new RangeError('calendarDaysBetween: "tomorrow" is not a YYYY-MM-DD calendar day'));
  });
});

describe("wholeMonthsBetween", () => {
  it("counts the months completed between two days", () => {
    expect(wholeMonthsBetween("2026-01-15", "2026-01-15")).toBe(0);
    expect(wholeMonthsBetween("2026-01-15", "2026-02-14")).toBe(0);
    expect(wholeMonthsBetween("2026-01-15", "2026-02-15")).toBe(1);
    expect(wholeMonthsBetween("2026-01-15", "2027-01-14")).toBe(11);
    expect(wholeMonthsBetween("2026-01-15", "2027-01-15")).toBe(12);
  });

  it("completes a month on the clamped month end", () => {
    expect(wholeMonthsBetween("2026-01-31", "2026-02-27")).toBe(0);
    expect(wholeMonthsBetween("2026-01-31", "2026-02-28")).toBe(1);
    expect(wholeMonthsBetween("2026-01-31", "2026-03-30")).toBe(1);
    expect(wholeMonthsBetween("2026-01-31", "2026-03-31")).toBe(2);
  });

  it("is negative with the days swapped", () => {
    expect(wholeMonthsBetween("2026-02-15", "2026-01-15")).toBe(-1);
    expect(wholeMonthsBetween("2026-02-28", "2026-01-31")).toBe(-1);
    expect(wholeMonthsBetween("2027-01-14", "2026-01-15")).toBe(-11);
  });

  it("rejects a malformed day", () => {
    expect(() => wholeMonthsBetween("2026-02-30", "2026-03-01")).toThrow(new RangeError('wholeMonthsBetween: "2026-02-30" is not a YYYY-MM-DD calendar day'));
  });
});
