// Calendar date ticks at midnight in the app's time zone. The oracle is a table written by hand
// (L-053): each instant is local midnight read off a calendar, with the zone's offset on that day.
// Tests run in America/New_York (vitest.config.mts), so a tick computed in the machine's zone
// instead of the given one fails every Europe/Warsaw row.
import { describe, expect, it } from "vitest";
import { dateTicks, formatDateTick } from "./date-ticks.js";

const WARSAW = "Europe/Warsaw";
const NEW_YORK = "America/New_York";

function isoTicks(start: string, end: string, target: number, timeZone: string) {
  const result = dateTicks({ start: new Date(start), end: new Date(end), target, timeZone });
  return result && { unit: result.unit, step: result.step, ticks: result.ticks.map((tick) => tick.toISOString()) };
}

describe("dateTicks: days", () => {
  it("puts each midnight on the local calendar across the March DST change", () => {
    // Warsaw moves from +01:00 to +02:00 at 02:00 on 2026-03-29.
    expect(isoTicks("2026-03-27T09:00:00Z", "2026-03-31T10:00:00Z", 4, WARSAW)).toEqual({
      unit: "day",
      step: 1,
      ticks: [
        "2026-03-27T23:00:00.000Z",
        "2026-03-28T23:00:00.000Z",
        "2026-03-29T22:00:00.000Z",
        "2026-03-30T22:00:00.000Z",
      ],
    });
  });

  it("puts each midnight on the local calendar across the October DST change", () => {
    // Warsaw moves from +02:00 back to +01:00 at 03:00 on 2026-10-25.
    expect(isoTicks("2026-10-23T12:00:00Z", "2026-10-27T12:00:00Z", 4, WARSAW)).toEqual({
      unit: "day",
      step: 1,
      ticks: [
        "2026-10-23T22:00:00.000Z",
        "2026-10-24T22:00:00.000Z",
        "2026-10-25T23:00:00.000Z",
        "2026-10-26T23:00:00.000Z",
      ],
    });
  });

  it("takes the first instant after a midnight that does not exist", () => {
    // Santiago springs from 24:00 (-04:00) to 01:00 (-03:00) on 2026-09-06, so that day starts at 01:00.
    expect(isoTicks("2026-09-04T12:00:00Z", "2026-09-07T12:00:00Z", 3, "America/Santiago")?.ticks).toEqual([
      "2026-09-05T04:00:00.000Z",
      "2026-09-06T04:00:00.000Z",
      "2026-09-07T03:00:00.000Z",
    ]);
  });

  it("finds midnight when the offset changes between the guess and the answer", () => {
    // Santiago falls back from 24:00 (-03:00) to 23:00 (-04:00) on 2026-04-04, so 2026-04-05 starts
    // at 04:00Z, while the offset of the first guess (-03:00) points at 03:00Z, still 4 April there.
    expect(isoTicks("2026-04-03T12:00:00Z", "2026-04-06T12:00:00Z", 3, "America/Santiago")?.ticks).toEqual([
      "2026-04-04T03:00:00.000Z",
      "2026-04-05T04:00:00.000Z",
      "2026-04-06T04:00:00.000Z",
    ]);
  });

  it("starts weeks on Monday", () => {
    // 2026-03-02 and 2026-03-09 ... are Mondays; 28 days, target 4 -> weekly.
    expect(isoTicks("2026-03-01T12:00:00Z", "2026-03-29T12:00:00Z", 4, WARSAW)).toEqual({
      unit: "day",
      step: 7,
      ticks: [
        "2026-03-01T23:00:00.000Z",
        "2026-03-08T23:00:00.000Z",
        "2026-03-15T23:00:00.000Z",
        "2026-03-22T23:00:00.000Z",
      ],
    });
  });
});

describe("dateTicks: months", () => {
  it("aligns quarters to January and prefers the larger step on a tie", () => {
    // Every 2 months: Mar, May, Jul, Sep, Nov (5); every 3: Apr, Jul, Oct (3). Both are 1 from 4.
    expect(isoTicks("2026-01-15T12:00:00Z", "2026-12-31T12:00:00Z", 4, WARSAW)).toEqual({
      unit: "month",
      step: 3,
      ticks: ["2026-03-31T22:00:00.000Z", "2026-06-30T22:00:00.000Z", "2026-09-30T22:00:00.000Z"],
    });
  });

  it("includes a start that falls on a boundary, in the given zone", () => {
    // Midnight of 2026-01-01 in New York is 05:00Z; DST starts there on 2026-03-08, after the last tick.
    expect(isoTicks("2026-01-01T05:00:00Z", "2026-03-15T00:00:00Z", 3, NEW_YORK)).toEqual({
      unit: "month",
      step: 1,
      ticks: ["2026-01-01T05:00:00.000Z", "2026-02-01T05:00:00.000Z", "2026-03-01T05:00:00.000Z"],
    });
  });
});

describe("dateTicks: years", () => {
  it("picks round years over a long span, as yearTicks does for year numbers", () => {
    const result = isoTicks("2026-10-06T12:00:00Z", "2081-06-01T00:00:00Z", 5, WARSAW);
    expect(result).toEqual({
      unit: "year",
      step: 10,
      ticks: [2030, 2040, 2050, 2060, 2070, 2080].map((year) => `${year - 1}-12-31T23:00:00.000Z`),
    });
  });

  it("skips the day and month candidates of a century instead of building them", () => {
    // 36 500 day ticks would be built and thrown away without the estimate.
    const started = performance.now();
    const result = dateTicks({
      start: new Date("2000-01-01T00:00:00Z"),
      end: new Date("2100-01-01T00:00:00Z"),
      target: 4,
      timeZone: WARSAW,
    });
    expect(result?.unit).toBe("year");
    expect(result?.step).toBe(25);
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("dateTicks: nothing to show", () => {
  it.each([
    ["an empty span", "2026-01-01T00:00:00Z", "2026-01-01T00:00:00Z", 4],
    ["an end before the start", "2026-02-01T00:00:00Z", "2026-01-01T00:00:00Z", 4],
    ["a target below one", "2026-01-01T00:00:00Z", "2026-12-01T00:00:00Z", 0],
  ])("returns null for %s", (_, start, end, target) => {
    expect(dateTicks({ start: new Date(start), end: new Date(end), target, timeZone: WARSAW })).toBeNull();
  });

  it("returns null when no boundary falls inside a short span", () => {
    expect(dateTicks({ start: new Date("2026-01-01T09:00:00Z"), end: new Date("2026-01-01T15:00:00Z"), target: 4, timeZone: WARSAW })).toBeNull();
  });
});

describe("formatDateTick", () => {
  const april = new Date("2026-03-31T22:00:00Z"); // midnight of 1 April in Warsaw, 31 March in New York

  it.each([
    ["year", "en-US", WARSAW, "2026"],
    ["month", "en-US", WARSAW, "Apr 2026"],
    ["day", "en-US", WARSAW, "Apr 1"],
    ["day", "en-GB", WARSAW, "1 Apr"],
    ["month", "en-US", NEW_YORK, "Mar 2026"],
    ["day", "en-US", NEW_YORK, "Mar 31"],
  ] as const)("labels a %s tick in %s, %s as %s", (unit, locale, timeZone, expected) => {
    expect(formatDateTick(april, unit, { locale, timeZone })).toBe(expected);
  });
});
