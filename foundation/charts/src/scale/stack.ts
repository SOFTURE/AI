// Stacked series: each series drawn as a band on top of the ones before it. The stacking happens in data space, so
// the y domain (`peakOf`, `troughOf` over the bands' edges) and the drawing share one set of numbers.
import type { ChartTone } from "../svg/class-names.js";
import { type ChartPoint, toNumber } from "./scale.js";

/** A series to stack, with how its band is coloured (the band's position gives a slot when none is named). */
export interface StackInput {
  readonly key: string;
  /** The series' own values; every series of a stack has the same x values, in the same order. */
  readonly points: readonly ChartPoint[];
  readonly slot?: number;
  readonly tone?: ChartTone;
  readonly color?: string;
}

/** A stacked band: the series' values sit between `lower` and `upper`, in data space. */
export interface StackedBand extends Omit<StackInput, "points"> {
  readonly lower: readonly ChartPoint[];
  readonly upper: readonly ChartPoint[];
}

/**
 * The series stacked in order, first at the bottom: at each x a positive value sits on top of the positive values
 * before it, a negative one under the negative values before it, so a band never overlaps another. Every series must
 * share the first series' x values; a mismatch is a bug in the caller and throws a `RangeError` naming the series.
 */
export function stackSeries(series: readonly StackInput[]): StackedBand[] {
  const xs = series[0]?.points.map((point) => point.x) ?? [];
  const above = xs.map(() => 0);
  const below = xs.map(() => 0);
  return series.map(({ points, ...look }) => {
    if (points.length !== xs.length || points.some((point, index) => toNumber(point.x) !== toNumber(xs[index] ?? Number.NaN))) {
      throw new RangeError(`stackSeries: series "${look.key}" does not share the x values of series "${series[0]?.key ?? ""}"`);
    }
    const lower: ChartPoint[] = [];
    const upper: ChartPoint[] = [];
    points.forEach((point, index) => {
      const edges = point.y >= 0 ? above : below;
      const base = edges[index] ?? 0;
      const top = base + point.y;
      edges[index] = top;
      lower.push({ x: point.x, y: point.y >= 0 ? base : top });
      upper.push({ x: point.x, y: point.y >= 0 ? top : base });
    });
    return { ...look, lower, upper };
  });
}
