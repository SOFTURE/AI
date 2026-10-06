// Ported from FIRE_TRACKER `chart-scale.test.ts`: the peak is taken over every series, and the
// scales keep a degenerate chart finite. FIRE's stacked point (accessible + locked) is passed
// through `getValue`, as FIRE will call it.
import { describe, expect, it } from "vitest";
import { linearScale, peakOf, timeScale, toNumber } from "./scale.js";

interface StackedPoint {
  readonly monthIndex: number;
  readonly accessible: number;
  readonly locked: number;
}

const stacked = (monthIndex: number, accessible: number, locked = 0): StackedPoint => ({ monthIndex, accessible, locked });
const totalOf = (point: StackedPoint) => point.accessible + point.locked;
const STACKED = { getValue: totalOf, floor: 1 };

describe("peakOf", () => {
  it("takes the value getValue returns, e.g. the sum of stacked parts", () => {
    // The scale must fit the locked band drawn above the accessible line.
    expect(peakOf([[stacked(0, 100, 900)]], STACKED)).toBe(1000);
  });

  it("defaults to the y of a chart point", () => {
    expect(peakOf([[{ x: 0, y: 3 }, { x: 1, y: 7 }]])).toBe(7);
  });

  it("takes the maximum over every series, not the first, in any order", () => {
    const base = [stacked(0, 100), stacked(12, 500)];
    const variant = [stacked(0, 100), stacked(12, 5_000)];
    expect(peakOf([base], STACKED)).toBe(500);
    expect(peakOf([base, variant], STACKED)).toBe(5_000);
    expect(peakOf([variant, base], STACKED)).toBe(5_000);
  });

  it("never goes below the floor, for empty series and zero values alike", () => {
    expect(peakOf([], STACKED)).toBe(1);
    expect(peakOf([[]], STACKED)).toBe(1);
    expect(peakOf([[stacked(0, 0, 0)]], STACKED)).toBe(1);
  });

  it("floors at zero by default, so fractional units keep their peak", () => {
    expect(peakOf([])).toBe(0);
    expect(peakOf([[{ x: 0, y: 0.5 }]])).toBe(0.5);
  });
});

describe("linearScale as a y axis", () => {
  // FIRE's scaleY({ peak, height: 200, paddingBottom: 24 }) with its 8 px top margin.
  const y = (peak: number) => linearScale({ domain: [0, peak], range: [200 - 24, 8] });

  it("puts zero on the baseline and the peak under the top edge", () => {
    expect(y(1000)(0)).toBe(176);
    expect(y(1000)(1000)).toBe(8);
  });

  it("puts the same value lower on a higher scale", () => {
    expect(y(5000)(1000)).toBeGreaterThan(y(1000)(1000));
  });

  it("inverts a pixel back to its value", () => {
    expect(y(1000).invert(176)).toBe(0);
    expect(y(1000).invert(8)).toBe(1000);
    expect(y(1000).invert(92)).toBe(500);
  });
});

describe("linearScale as an x axis", () => {
  // FIRE's scaleX({ paddingLeft: 8, width: 720, horizonMonthIndex }).
  const x = (horizon: number) => linearScale({ domain: [0, horizon], range: [8, 712] });

  it("divides by the stated horizon, not by the number of points", () => {
    expect(x(660)(0)).toBe(8);
    expect(x(660)(660)).toBe(712);
    expect(x(660)(330)).toBe(360);
  });

  it("maps a zero horizon to the range start instead of dividing by zero", () => {
    expect(x(0)(0)).toBe(8);
    expect(x(0)(12)).toBe(8);
    expect(x(0).invert(400)).toBe(0);
  });

  it("extrapolates outside the range instead of clamping", () => {
    expect(x(660).invert(0)).toBeCloseTo(-7.5, 9);
  });
});

describe("timeScale", () => {
  const start = new Date("2026-01-01T00:00:00Z");
  const end = new Date("2026-01-11T00:00:00Z");
  const x = timeScale({ domain: [start, end], range: [0, 100] });

  it("maps dates and epoch milliseconds alike", () => {
    expect(x(start)).toBe(0);
    expect(x(end)).toBe(100);
    expect(x(new Date("2026-01-06T00:00:00Z"))).toBe(50);
    expect(x(Date.UTC(2026, 0, 2))).toBe(10);
  });

  it("inverts a pixel to a date", () => {
    expect(x.invert(30).toISOString()).toBe("2026-01-04T00:00:00.000Z");
  });

  it("keeps a one-instant domain finite", () => {
    const flat = timeScale({ domain: [start, start], range: [0, 100] });
    expect(flat(end)).toBe(0);
    expect(flat.invert(50).getTime()).toBe(start.getTime());
  });
});

describe("toNumber", () => {
  it("reads a date as epoch milliseconds and a number as itself", () => {
    expect(toNumber(new Date(42))).toBe(42);
    expect(toNumber(7)).toBe(7);
  });
});
