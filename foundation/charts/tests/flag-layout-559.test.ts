// Issue #559: flags stacked into rows so their labels do not collide. Oracles are written by hand.
import { describe, expect, it } from "vitest";
import { type FlagLayoutInput, layoutFlags } from "../src/index.js";

function rowsOf(flags: readonly FlagLayoutInput[], options?: Parameters<typeof layoutFlags>[1]): (number | null)[] {
  return layoutFlags(flags, options).placements.map((placement) => placement.row);
}

describe("layoutFlags", () => {
  it("puts each flag on the lowest row it fits, in input order", () => {
    // Extents (centred): a 5–15, b 10–20, c 15–25, d 40–50.
    const flags = [
      { x: 10, width: 10 },
      { x: 15, width: 10 },
      { x: 20, width: 10 },
      { x: 45, width: 10 },
    ];
    const layout = layoutFlags(flags);
    expect(layout.placements.map((placement) => placement.row)).toEqual([0, 1, 0, 0]);
    expect(layout.rows).toBe(2);
    expect(layout.hiddenCount).toBe(0);
    expect(layout.placements[1]).toEqual({ hidden: false, row: 1, start: 10, end: 20 });
  });

  it("lets flags touch without a gap and splits them with one", () => {
    const touching = [
      { x: 0, width: 10, align: "start" as const },
      { x: 10, width: 10, align: "start" as const },
    ];
    expect(rowsOf(touching)).toEqual([0, 0]);
    expect(rowsOf(touching, { gap: 1 })).toEqual([0, 1]);
    // 2 apart: a gap of 2 still fits, a gap of 2.5 does not.
    const apart = [
      { x: 0, width: 10, align: "start" as const },
      { x: 12, width: 10, align: "start" as const },
    ];
    expect(rowsOf(apart, { gap: 2 })).toEqual([0, 0]);
    expect(rowsOf(apart, { gap: 2.5 })).toEqual([0, 1]);
  });

  it("takes the extent from the alignment", () => {
    const placements = layoutFlags([
      { x: 50, width: 10, align: "start" },
      { x: 50, width: 10, align: "end" },
      { x: 50, width: 10 },
    ]).placements;
    expect(placements.map(({ start, end }) => [start, end])).toEqual([
      [50, 60],
      [40, 50],
      [45, 55],
    ]);
    // The end-aligned flag (40–50) and the start-aligned one (50–60) touch; the centred one overlaps both.
    expect(placements.map((placement) => placement.row)).toEqual([0, 0, 1]);
  });

  it("hides the flags beyond maxRows and counts them instead of overlapping them", () => {
    const flags = [
      { x: 10, width: 10 },
      { x: 11, width: 10 },
      { x: 12, width: 10 },
      { x: 13, width: 10 },
      { x: 40, width: 10 },
    ];
    const layout = layoutFlags(flags, { maxRows: 2 });
    expect(layout.placements.map((placement) => placement.row)).toEqual([0, 1, null, null, 0]);
    expect(layout.placements.map((placement) => placement.hidden)).toEqual([false, false, true, true, false]);
    expect(layout.placements[2]).toEqual({ hidden: true, row: null, start: 7, end: 17 });
    expect(layout.rows).toBe(2);
    expect(layout.hiddenCount).toBe(2);
  });

  it("is deterministic: flags at the same place take rows by input order, whatever the order of the rest", () => {
    const same = [
      { x: 30, width: 10 },
      { x: 30, width: 10 },
      { x: 30, width: 10 },
    ];
    expect(rowsOf(same)).toEqual([0, 1, 2]);
    expect(rowsOf(same, { maxRows: 1 })).toEqual([0, null, null]);
    const flags = [
      { x: 60, width: 30 },
      { x: 50, width: 30 },
      { x: 10, width: 4 },
    ];
    expect(rowsOf(flags)).toEqual([1, 0, 0]);
    expect(rowsOf([...flags].reverse())).toEqual([0, 0, 1]);
  });

  it("lays out nothing for no flags", () => {
    expect(layoutFlags([])).toEqual({ placements: [], rows: 0, hiddenCount: 0 });
  });

  it("never puts two overlapping flags in one row", () => {
    // A fixed pseudo-random set: x and width from a linear congruential sequence.
    let seed = 7;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const flags = Array.from({ length: 60 }, () => ({ x: next() * 100, width: 2 + next() * 15 }));
    const gap = 1.5;
    const { placements, hiddenCount } = layoutFlags(flags, { gap, maxRows: 4 });
    expect(hiddenCount).toBeGreaterThan(0);
    const shown = placements.filter((placement) => !placement.hidden);
    for (const a of shown) {
      for (const b of shown) {
        if (a === b || a.row !== b.row) continue;
        const isApart = a.end + gap <= b.start || b.end + gap <= a.start;
        expect(isApart).toBe(true);
      }
    }
  });

  it("throws a RangeError for input that is a programming error", () => {
    expect(() => layoutFlags([{ x: Number.NaN, width: 1 }])).toThrow(RangeError);
    expect(() => layoutFlags([{ x: 1, width: Number.POSITIVE_INFINITY }])).toThrow(RangeError);
    expect(() => layoutFlags([{ x: 1, width: -1 }])).toThrow(RangeError);
    expect(() => layoutFlags([], { maxRows: 0 })).toThrow(RangeError);
    expect(() => layoutFlags([], { maxRows: 1.5 })).toThrow(RangeError);
    expect(() => layoutFlags([], { gap: -1 })).toThrow(RangeError);
    expect(() => layoutFlags([], { gap: Number.NaN })).toThrow(RangeError);
  });
});
