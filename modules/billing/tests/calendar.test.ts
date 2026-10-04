// Calendar days in the app's time zone: trial ends at the start of a local day, across DST changes
// and in zones far from the process's own (the tests run in New York time).
import { getDayNumber, getDaysLeft, getStartOfDay, getTrialEnd, parseDay } from "@softure-ai/billing";
import { describe, expect, it } from "vitest";

describe("getTrialEnd", () => {
  it.each([
    ["a morning in Warsaw summer time", "2026-10-03T08:00:00Z", 14, "Europe/Warsaw", "2026-10-16T22:00:00Z"],
    ["late evening, already the next day in Warsaw", "2026-10-03T22:30:00Z", 14, "Europe/Warsaw", "2026-10-17T22:00:00Z"],
    ["a trial across the end of summer time", "2026-10-20T10:00:00Z", 14, "Europe/Warsaw", "2026-11-02T23:00:00Z"],
    ["a trial across the start of summer time", "2026-03-20T10:00:00Z", 14, "Europe/Warsaw", "2026-04-02T22:00:00Z"],
    ["UTC", "2026-10-03T23:59:59Z", 1, "UTC", "2026-10-04T00:00:00Z"],
    ["Tokyo, a day ahead of UTC at night", "2026-10-03T20:00:00Z", 1, "Asia/Tokyo", "2026-10-04T15:00:00Z"],
    ["zero days: the start of the start day", "2026-10-03T08:00:00Z", 0, "Europe/Warsaw", "2026-10-02T22:00:00Z"],
  ])("ends at the start of a local day: %s", (_case, start, days, timezone, end) => {
    expect(getTrialEnd(new Date(start), days, timezone)).toEqual(new Date(end));
  });
});

describe("getStartOfDay", () => {
  it("finds local midnight on the day summer time ends and on the day it starts", () => {
    // 25 October 2026 and 29 March 2026: the changes happen at 03:00 and 02:00, after midnight.
    expect(getStartOfDay(Date.UTC(2026, 9, 25) / 86_400_000, "Europe/Warsaw")).toEqual(new Date("2026-10-24T22:00:00Z"));
    expect(getStartOfDay(Date.UTC(2026, 2, 29) / 86_400_000, "Europe/Warsaw")).toEqual(new Date("2026-03-28T23:00:00Z"));
  });

  it("starts a day that skips midnight at the first instant after the gap", () => {
    // Santiago moves from 00:00 to 01:00 on 6 September 2026 (UTC-4 to UTC-3).
    expect(getStartOfDay(Date.UTC(2026, 8, 6) / 86_400_000, "America/Santiago")).toEqual(new Date("2026-09-06T04:00:00Z"));
    expect(getTrialEnd(new Date("2026-09-01T15:00:00Z"), 5, "America/Santiago")).toEqual(new Date("2026-09-06T04:00:00Z"));
  });
});

describe("getDaysLeft", () => {
  const end = new Date("2026-10-16T22:00:00Z");

  it("counts local days, today included, so the last day is 1", () => {
    expect(getDaysLeft(end, new Date("2026-10-03T08:00:00Z"), "Europe/Warsaw")).toBe(14);
    expect(getDaysLeft(end, new Date("2026-10-16T00:00:00Z"), "Europe/Warsaw")).toBe(1);
    expect(getDaysLeft(end, new Date("2026-10-16T21:59:59Z"), "Europe/Warsaw")).toBe(1);
  });

  it("counts a 23-hour and a 25-hour day as one day each", () => {
    expect(getDaysLeft(new Date("2026-10-26T23:00:00Z"), new Date("2026-10-24T08:00:00Z"), "Europe/Warsaw")).toBe(3);
  });
});

describe("parseDay", () => {
  it("gives the day number getDayNumber counts for that local day", () => {
    expect(parseDay("2026-10-03")).toBe(getDayNumber(new Date("2026-10-03T08:00:00Z"), "Europe/Warsaw"));
    expect(parseDay("2026-10-04")).toBe(getDayNumber(new Date("2026-10-03T22:30:00Z"), "Europe/Warsaw"));
    expect(parseDay("2028-02-29")).toBe(Date.UTC(2028, 1, 29) / 86_400_000);
  });

  it.each(["2026-02-30", "2027-02-29", "2026-13-01", "2026-1-1", "2026-10-03T00:00:00Z", " 2026-10-03", ""])("refuses %j", (day) => {
    expect(parseDay(day)).toBeNull();
  });
});
