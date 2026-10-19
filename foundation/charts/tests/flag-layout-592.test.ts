// Issue #592: a flag that spans several rows (a two-line chip) in layoutFlags. Oracles are written by hand.
import { describe, expect, it } from "vitest";
import { type FlagLayoutInput, layoutFlags } from "../src/index.js";

function rowsOf(flags: readonly FlagLayoutInput[], options?: Parameters<typeof layoutFlags>[1]): (number | null)[] {
  return layoutFlags(flags, options).placements.map((placement) => placement.row);
}

describe("layoutFlags with rows", () => {
  it("lifts only the flags a two-row flag collides with, and only below its span", () => {
    // Extents (start-aligned): a 0–10 two rows tall, b 5–15, c 30–40, d 32–42.
    const flags = [
      { x: 0, width: 10, align: "start" as const, rows: 2 },
      { x: 5, width: 10, align: "start" as const },
      { x: 30, width: 10, align: "start" as const },
      { x: 32, width: 10, align: "start" as const },
    ];
    const layout = layoutFlags(flags);
    // b collides with a, which takes rows 0 and 1, so b goes to row 2; c and d, far away, need no third row.
    expect(layout.placements.map((placement) => placement.row)).toEqual([0, 2, 0, 1]);
    expect(layout.rows).toBe(3);
    expect(layout.placements[0]).toEqual({ hidden: false, row: 0, start: 0, end: 10 });
  });

  it("starts a two-row flag only where every row it spans is free", () => {
    // a 0–10 in row 0, b 20–30 in row 0, then c 5–25 two rows tall overlaps both: rows 1 and 2.
    // d 24–34 overlaps b (row 0) and c (rows 1–2): row 3.
    const flags = [
      { x: 0, width: 10, align: "start" as const },
      { x: 20, width: 10, align: "start" as const },
      { x: 5, width: 20, align: "start" as const, rows: 2 },
      { x: 24, width: 10, align: "start" as const },
    ];
    const layout = layoutFlags(flags);
    expect(layout.placements.map((placement) => placement.row)).toEqual([0, 0, 1, 3]);
    expect(layout.rows).toBe(4);
  });

  it("does not let a flag take a row that is free above a span but busy inside it", () => {
    // a 0–10 in row 0; b 2–12 one row in row 1; c 11–21 two rows: row 0 is free from 10, row 1 is busy until 12, so
    // c cannot start in row 0 (its second row collides with b) and starts in row 2.
    const flags = [
      { x: 0, width: 10, align: "start" as const },
      { x: 2, width: 10, align: "start" as const },
      { x: 11, width: 10, align: "start" as const, rows: 2 },
    ];
    expect(rowsOf(flags)).toEqual([0, 1, 2]);
    // With rows 1, c takes row 0 again.
    expect(rowsOf(flags.map((flag) => ({ ...flag, rows: 1 })))).toEqual([0, 1, 0]);
  });

  it("applies maxRows to the spanned rows and hides the flag that would end below them", () => {
    const flags = [
      { x: 0, width: 10, align: "start" as const },
      { x: 5, width: 10, align: "start" as const, rows: 2 },
      { x: 40, width: 10, align: "start" as const, rows: 2 },
    ];
    const layout = layoutFlags(flags, { maxRows: 2 });
    expect(layout.placements.map((placement) => placement.row)).toEqual([0, null, 0]);
    expect(layout.placements[1]).toEqual({ hidden: true, row: null, start: 5, end: 15 });
    expect(layout.hiddenCount).toBe(1);
    expect(layout.rows).toBe(2);
    // A flag taller than maxRows never fits.
    expect(rowsOf([{ x: 0, width: 1, rows: 3 }], { maxRows: 2 })).toEqual([null]);
  });

  it("lays out rows: 1 exactly as no rows", () => {
    const flags = [
      { x: 10, width: 10 },
      { x: 15, width: 10 },
      { x: 20, width: 10 },
      { x: 45, width: 10 },
    ];
    expect(layoutFlags(flags.map((flag) => ({ ...flag, rows: 1 })), { gap: 1 })).toEqual(layoutFlags(flags, { gap: 1 }));
  });

  it("never puts two overlapping flags in a shared row", () => {
    // A fixed pseudo-random set: x, width and rows from a linear congruential sequence.
    let seed = 11;
    const next = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const flags = Array.from({ length: 60 }, () => ({ x: next() * 100, width: 2 + next() * 15, rows: next() < 0.3 ? 2 : 1 }));
    const gap = 1.5;
    const maxRows = 5;
    const { placements, rows, hiddenCount } = layoutFlags(flags, { gap, maxRows });
    expect(hiddenCount).toBeGreaterThan(0);
    const shown = placements.flatMap((placement, index) => (placement.hidden ? [] : [{ ...placement, span: flags[index]?.rows ?? 1 }]));
    expect(Math.max(...shown.map((flag) => flag.row + flag.span))).toBe(rows);
    expect(rows).toBeLessThanOrEqual(maxRows);
    for (const a of shown) {
      for (const b of shown) {
        const isSharingRow = a.row < b.row + b.span && b.row < a.row + a.span;
        if (a === b || !isSharingRow) continue;
        const isApart = a.end + gap <= b.start || b.end + gap <= a.start;
        expect(isApart).toBe(true);
      }
    }
  });

  it("throws a RangeError for rows that is not a whole number of at least 1", () => {
    expect(() => layoutFlags([{ x: 1, width: 1, rows: 0 }])).toThrow(RangeError);
    expect(() => layoutFlags([{ x: 1, width: 1, rows: 1.5 }])).toThrow(RangeError);
    expect(() => layoutFlags([{ x: 1, width: 1, rows: Number.NaN }])).toThrow(RangeError);
    expect(() => layoutFlags([{ x: 1, width: 1, rows: Number.POSITIVE_INFINITY }])).toThrow(RangeError);
  });
});
