// The layout of flags over a time axis, without the DOM: which row each flag's chip takes so labels never collide,
// and which flags do not fit. Server-safe; the caller gives each flag's width (measured, or estimated from its label).
import type { EdgeAlign } from "./geometry.js";

/** A flag to lay out: `x` and `width` in one unit (e.g. percent of the plot's width). */
export interface FlagLayoutInput {
  readonly x: number;
  /** The chip's width, at least 0. */
  readonly width: number;
  /** Where the chip sits against `x`, as `ChartFlag` aligns it (`edgeAlign(x)` there). Default `center`. */
  readonly align?: EdgeAlign;
  /** How many rows the chip is tall, a whole number of at least 1 (e.g. 2 for a two-line chip). Default 1. */
  readonly rows?: number;
}

export interface FlagLayoutOptions {
  /** The least space between two chips in one row, in the unit of `x`. Default 0: chips may touch. */
  readonly gap?: number;
  /** The most rows to use, a whole number of at least 1; the flags that do not fit are hidden. Default: no limit. */
  readonly maxRows?: number;
}

interface FlagExtent {
  /** Where the chip starts and ends, in the unit of `x`. */
  readonly start: number;
  readonly end: number;
}

/** A flag with a row: 0 is the top row; a flag with `rows` above 1 also takes the rows below it. */
export interface ShownFlagPlacement extends FlagExtent {
  readonly hidden: false;
  readonly row: number;
}

/** A flag that fits in no row within `maxRows`. */
export interface HiddenFlagPlacement extends FlagExtent {
  readonly hidden: true;
  readonly row: null;
}

export type FlagPlacement = ShownFlagPlacement | HiddenFlagPlacement;

export interface FlagLayout {
  /** One placement per flag, in input order. */
  readonly placements: readonly FlagPlacement[];
  /** How many rows the shown flags use, the rows they span included. */
  readonly rows: number;
  /** How many flags are hidden, e.g. for a "+N" marker. */
  readonly hiddenCount: number;
}

/**
 * Flags packed into the fewest rows that keep chips in one row at least `gap` apart: by start, then end, then input
 * order, each flag takes the lowest row where every row it spans (`rows`) is free. A flag that fits in no row within
 * `maxRows` is hidden, never overlapped. The same input always gives the same rows. Throws a `RangeError` for a
 * non-finite `x` or `width`, a negative `width`, a `rows` or `maxRows` that is not a whole number of at least 1, or a
 * negative or non-finite `gap`.
 */
export function layoutFlags(flags: readonly FlagLayoutInput[], { gap = 0, maxRows = Number.POSITIVE_INFINITY }: FlagLayoutOptions = {}): FlagLayout {
  assertOptions(gap, maxRows);
  const extents = flags.map((flag, index) => ({ index, span: getSpan(flag, index), ...getExtent(flag, index) }));
  const ordered = [...extents].sort((a, b) => a.start - b.start || a.end - b.end || a.index - b.index);
  // The end of the last chip in each row: flags come by start, so a row is free from there on.
  const rowEnds: number[] = [];
  const rows = new Map<number, number>();
  for (const flag of ordered) {
    const isFree = (row: number) => (rowEnds[row] ?? Number.NEGATIVE_INFINITY) + gap <= flag.start;
    const spansFree = (row: number) => Array.from({ length: flag.span }, (_, offset) => row + offset).every(isFree);
    const top = Array.from({ length: rowEnds.length + 1 }, (_, row) => row).find(spansFree);
    if (top === undefined || top + flag.span > maxRows) continue;
    for (let row = top; row < top + flag.span; row += 1) rowEnds[row] = flag.end;
    rows.set(flag.index, top);
  }
  const placements = extents.map(({ index, start, end }): FlagPlacement => {
    const row = rows.get(index);
    return row === undefined ? { hidden: true, row: null, start, end } : { hidden: false, row, start, end };
  });
  return { placements, rows: rowEnds.length, hiddenCount: flags.length - rows.size };
}

function getExtent({ x, width, align = "center" }: FlagLayoutInput, index: number): FlagExtent {
  if (!Number.isFinite(x) || !Number.isFinite(width) || width < 0) {
    throw new RangeError(`layoutFlags: flag ${String(index)} needs a finite x and a finite width of at least 0 (x ${String(x)}, width ${String(width)}).`);
  }
  if (align === "start") return { start: x, end: x + width };
  if (align === "end") return { start: x - width, end: x };
  return { start: x - width / 2, end: x + width / 2 };
}

function getSpan({ rows = 1 }: FlagLayoutInput, index: number): number {
  if (!Number.isInteger(rows) || rows < 1) throw new RangeError(`layoutFlags: flag ${String(index)} needs rows as a whole number of at least 1 (got ${String(rows)}).`);
  return rows;
}

function assertOptions(gap: number, maxRows: number): void {
  if (!Number.isFinite(gap) || gap < 0) throw new RangeError(`layoutFlags: gap must be a finite number of at least 0 (got ${String(gap)}).`);
  const isWholeOrUnlimited = Number.isInteger(maxRows) || maxRows === Number.POSITIVE_INFINITY;
  if (!isWholeOrUnlimited || maxRows < 1) throw new RangeError(`layoutFlags: maxRows must be a whole number of at least 1 (got ${String(maxRows)}).`);
}
