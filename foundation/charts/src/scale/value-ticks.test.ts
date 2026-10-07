// The oracle is a table written by hand, not a second implementation of the step choice: each row
// is the answer a person gives looking at the peak ("which round lines go under 2.8 million"). The
// unit is the caller's; the values here are whole currency units with `minStep: 1`.
import { describe, expect, it } from "vitest";
import { valueTicks, yearTicks } from "./value-ticks.js";

const WHOLE_UNITS = { minStep: 1 };

describe("valueTicks: round steps under the peak", () => {
  it.each([
    // peak, target, expected ticks
    [2_827_053, 4, [500_000, 1_000_000, 1_500_000, 2_000_000, 2_500_000]],
    [744_000, 4, [200_000, 400_000, 600_000]],
    [3_000_000, 4, [1_000_000, 2_000_000, 3_000_000]],
    [1_702_008, 4, [500_000, 1_000_000, 1_500_000]],
    [96_500, 4, [20_000, 40_000, 60_000, 80_000]],
    [12_400_000, 3, [5_000_000, 10_000_000]],
    [1_800, 4, [500, 1_000, 1_500]],
    [11_000, 4, [2_500, 5_000, 7_500, 10_000]],
  ])("peak %d, target %d -> %j", (peak, target, expected) => {
    expect(valueTicks(peak, target, WHOLE_UNITS)).toEqual(expected);
  });

  it("draws no tick for a zero or negative peak, or a target below one", () => {
    expect(valueTicks(0, 4)).toEqual([]);
    expect(valueTicks(-500, 4)).toEqual([]);
    expect(valueTicks(100, 0)).toEqual([]);
  });

  it("never returns a tick above the peak: the scale does not change", () => {
    for (const tick of valueTicks(2_827_053, 4, WHOLE_UNITS)) expect(tick).toBeLessThanOrEqual(2_827_053);
  });

  it("draws no tick when the peak is below the minimum step", () => {
    // A peak of 0.50 currency units must draw no "0" lines.
    expect(valueTicks(0.5, 4, WHOLE_UNITS)).toEqual([]);
  });

  it("allows fractional steps without a minimum, free of floating point noise", () => {
    expect(valueTicks(1, 4)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(valueTicks(0.35, 3)).toEqual([0.1, 0.2, 0.3]);
  });
});

describe("yearTicks: round years on a time axis", () => {
  it.each([
    [2026, 2081, 5, [2030, 2040, 2050, 2060, 2070, 2080]],
    [2026, 2043, 4, [2030, 2035, 2040]],
    [2026, 2030, 4, [2027, 2028, 2029, 2030]],
  ])("%d-%d, target %d -> %j", (start, end, target, expected) => {
    expect(yearTicks(start, end, target)).toEqual(expected);
  });

  it("returns no ticks for a zero span", () => {
    expect(yearTicks(2026, 2026, 4)).toEqual([]);
  });
});

describe("valueTicks below zero", () => {
  it("adds round ticks under zero on the step chosen for the whole span", () => {
    expect(valueTicks(3_000, 4, { min: -1_000 })).toEqual([-1_000, 1_000, 2_000, 3_000]);
    expect(valueTicks(100, 5, { min: -250 })).toEqual([-200, -100, 100]);
  });

  it("works with no value above zero", () => {
    expect(valueTicks(0, 4, { min: -4_000 })).toEqual([-4_000, -3_000, -2_000, -1_000]);
  });

  it("is unchanged by a min of zero or above", () => {
    expect(valueTicks(3_000, 4, { min: 0 })).toEqual(valueTicks(3_000, 4));
    expect(valueTicks(3_000, 4, { min: 500 })).toEqual(valueTicks(3_000, 4));
  });
});
