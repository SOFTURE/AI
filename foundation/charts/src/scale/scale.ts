// Linear and time scales: one mapping from data to pixels, shared by the drawing and the cursor
// (two copies of the formula drift apart as soon as a second series appears).

/** A point of a series. `x` is a date or a number, `y` a value in the caller's unit. */
export interface ChartPoint {
  readonly x: Date | number;
  readonly y: number;
}

/** Start and end of a domain or a range. The end may be below the start (a y axis grows upwards). */
export type Interval<T> = readonly [start: T, end: T];

/** A scale maps a data value to a pixel and back. `Input` may be wider than what `invert` returns. */
export interface Scale<Value, Input = Value> {
  (value: Input): number;
  /** The data value at a pixel; outside the range it extrapolates, it does not clamp. */
  invert(pixel: number): Value;
  readonly domain: Interval<Value>;
  readonly range: Interval<number>;
}

interface LinearScaleOptions {
  readonly domain: Interval<number>;
  readonly range: Interval<number>;
}

/**
 * A linear scale. A zero-width domain (one value, a zero horizon) maps every value to the range
 * start and inverts to the domain start, so a degenerate chart draws finite numbers, never `NaN`.
 */
export function linearScale({ domain, range }: LinearScaleOptions): Scale<number> {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const isFlat = d1 === d0;
  const scale = (value: number): number => (isFlat ? r0 : r0 + ((value - d0) / (d1 - d0)) * (r1 - r0));
  const invert = (pixel: number): number => (isFlat || r1 === r0 ? d0 : d0 + ((pixel - r0) / (r1 - r0)) * (d1 - d0));
  return Object.assign(scale, { invert, domain, range });
}

interface TimeScaleOptions {
  readonly domain: Interval<Date>;
  readonly range: Interval<number>;
}

/** A linear scale over time (epoch milliseconds). Accepts a `Date` or milliseconds. */
export function timeScale({ domain, range }: TimeScaleOptions): Scale<Date, Date | number> {
  const linear = linearScale({ domain: [domain[0].getTime(), domain[1].getTime()], range });
  const scale = (value: Date | number): number => linear(toNumber(value));
  const invert = (pixel: number): Date => new Date(linear.invert(pixel));
  return Object.assign(scale, { invert, domain, range });
}

/** The numeric position of an x value: epoch milliseconds for a date. */
export function toNumber(value: Date | number): number {
  return value instanceof Date ? value.getTime() : value;
}

interface PeakOptions {
  /** The lowest peak returned, also for empty series; defaults to 0. */
  readonly floor?: number;
}

interface PeakOfValueOptions<P> extends PeakOptions {
  /** The value a point contributes to the peak, e.g. a sum of stacked parts. */
  readonly getValue: (point: P) => number;
}

/**
 * The peak shared by every series drawn on one chart. Taking it from the first series only puts
 * a higher second series off the chart and its cursor off the line.
 */
export function peakOf(series: readonly (readonly ChartPoint[])[], options?: PeakOptions): number;
export function peakOf<P>(series: readonly (readonly P[])[], options: PeakOfValueOptions<P>): number;
export function peakOf<P>(series: readonly (readonly P[])[], options: Partial<PeakOfValueOptions<P>> = {}): number {
  // Without `getValue` the first overload applies, so every point is a ChartPoint.
  const getValue = options.getValue ?? ((point: P) => (point as ChartPoint).y);
  let peak = options.floor ?? 0;
  for (const points of series) {
    for (const point of points) {
      const value = getValue(point);
      if (value > peak) peak = value;
    }
  }
  return peak;
}

interface TroughOptions<P> {
  /** The highest trough returned, also for empty series; defaults to 0, so a chart keeps its zero. */
  readonly ceiling?: number;
  /** The value a point contributes, `y` by default. */
  readonly getValue?: (point: P) => number;
}

/**
 * The lowest value of every series drawn on one chart, at most `ceiling` (0): the bottom of a value
 * domain that has negative values (a net worth with debt), and 0 when it has none.
 */
export function troughOf(series: readonly (readonly ChartPoint[])[], options?: TroughOptions<ChartPoint>): number;
export function troughOf<P>(series: readonly (readonly P[])[], options: TroughOptions<P> & { readonly getValue: (point: P) => number }): number;
export function troughOf<P>(series: readonly (readonly P[])[], options: TroughOptions<P> = {}): number {
  // Without `getValue` the first overload applies, so every point is a ChartPoint.
  const getValue = options.getValue ?? ((point: P) => (point as ChartPoint).y);
  let trough = options.ceiling ?? 0;
  for (const points of series) {
    for (const point of points) {
      const value = getValue(point);
      if (value < trough) trough = value;
    }
  }
  return trough;
}
