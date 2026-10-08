// The plot's coordinate system. Every chart draws in one fixed viewBox stretched to its box
// (`preserveAspectRatio="none"`), and everything laid over it in HTML (labels, flags, the cursor) is
// placed at the same position as a percentage, so the drawing and the overlay cannot drift apart.

/** Width of the plot's viewBox, in its own units. */
export const PLOT_WIDTH = 1000;
/** Height of the plot's viewBox, in its own units. */
export const PLOT_HEIGHT = 400;

/** A position in viewBox units as a percentage of `length` (the viewBox width or height). */
export function toPercent(units: number, length: number): number {
  return length === 0 ? 0 : (units / length) * 100;
}

/**
 * A percentage for `style`. Two decimals are enough (0.01 % of 1440 px is 0.14 px) and keep the
 * markup short.
 */
export function percent(value: number): string {
  return `${String(Number(value.toFixed(2)))}%`;
}

/** How a label sits on its position: from it to the right, centred on it, or up to it. */
export type EdgeAlign = "start" | "center" | "end";

/**
 * A label near either edge aligns to that edge instead of centring on its position, or it would
 * leave the card. One threshold for every chart: 18 % and 82 %.
 */
export function edgeAlign(xPercent: number): EdgeAlign {
  if (xPercent < 18) return "start";
  if (xPercent > 82) return "end";
  return "center";
}

/** A point in viewBox units. */
export interface PlotPoint {
  readonly x: number;
  readonly y: number;
}

/** The `d` of a polyline through `points`, in order; `""` for no points. */
export function linePath(points: readonly PlotPoint[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${round(point.x)} ${round(point.y)}`).join(" ");
}

/**
 * The `d` of a smooth curve through every point, in order: monotone cubic interpolation (Fritsch–Carlson). Each segment
 * is one `C` ending exactly on the next point, and between two points the curve stays within their y-range, so it never
 * draws a dip or a peak the data does not have (a Catmull-Rom curve would, before a step). A tangent is zero at a local
 * extreme; two points with the same x (a vertical step) give a straight vertical segment. `""` for no points.
 */
export function smoothLinePath(points: readonly PlotPoint[]): string {
  const first = points[0];
  if (first === undefined) return "";
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const tangents = getMonotoneTangents(xs, ys);
  const segments = [`M${round(first.x)} ${round(first.y)}`];
  for (let i = 0; i < points.length - 1; i += 1) {
    const third = (at(xs, i + 1) - at(xs, i)) / 3;
    const c1 = `${round(at(xs, i) + third)} ${round(at(ys, i) + third * at(tangents, i))}`;
    const c2 = `${round(at(xs, i + 1) - third)} ${round(at(ys, i + 1) - third * at(tangents, i + 1))}`;
    segments.push(`C${c1} ${c2} ${round(at(xs, i + 1))} ${round(at(ys, i + 1))}`);
  }
  return segments.join(" ");
}

/** How the edge of a line or an area runs between points: straight (`linear`) or `smoothLinePath`'s curve. */
export type PathCurve = "linear" | "smooth";

export interface AreaPathOptions {
  /**
   * Where the area closes: a y in viewBox units (`PLOT_HEIGHT`, the bottom of the plot, by default) or a lower edge of
   * points. A lower edge spans the same x-range as the upper one, left to right; the outline runs back along it, so a
   * band of a stacked chart is `areaPath(upper, { baseline: lower })`.
   */
  readonly baseline?: number | readonly PlotPoint[];
  readonly curve?: PathCurve;
}

/** The `d` of the closed shape under a line (or between two lines), to fill. `""` for no points. */
export function areaPath(points: readonly PlotPoint[], { baseline = PLOT_HEIGHT, curve = "linear" }: AreaPathOptions = {}): string {
  const first = points[0];
  const last = points.at(-1);
  if (first === undefined || last === undefined) return "";
  const pathOf = curve === "smooth" ? smoothLinePath : linePath;
  const top = pathOf(points);
  if (typeof baseline === "number") {
    return `${top} L${round(last.x)} ${round(baseline)} L${round(first.x)} ${round(baseline)} Z`;
  }
  if (baseline.length === 0) return `${top} Z`;
  // The lower edge drawn backwards, continuing the outline: its opening `M` becomes an `L`.
  const bottom = pathOf([...baseline].reverse()).replace(/^M/, "L");
  return `${top} ${bottom} Z`;
}

/** Fritsch–Carlson tangents: the mean of neighbouring secants, zero at an extreme, scaled down where they overshoot. */
function getMonotoneTangents(xs: readonly number[], ys: readonly number[]): number[] {
  const count = xs.length;
  if (count < 2) return [0];
  const secants: number[] = [];
  for (let i = 0; i < count - 1; i += 1) {
    const dx = at(xs, i + 1) - at(xs, i);
    secants.push(dx === 0 ? 0 : (at(ys, i + 1) - at(ys, i)) / dx);
  }
  const tangents: number[] = [at(secants, 0)];
  for (let i = 1; i < count - 1; i += 1) {
    const before = at(secants, i - 1);
    const after = at(secants, i);
    tangents.push(before * after <= 0 ? 0 : (before + after) / 2);
  }
  tangents.push(at(secants, count - 2));
  for (let i = 0; i < count - 1; i += 1) {
    const secant = at(secants, i);
    if (secant === 0) {
      tangents[i] = 0;
      tangents[i + 1] = 0;
      continue;
    }
    const alpha = at(tangents, i) / secant;
    const beta = at(tangents, i + 1) / secant;
    const length = alpha * alpha + beta * beta;
    if (length > 9) {
      const scale = 3 / Math.sqrt(length);
      tangents[i] = scale * alpha * secant;
      tangents[i + 1] = scale * beta * secant;
    }
  }
  return tangents;
}

/** `values[index]`, for indexes the loops above keep in range (`noUncheckedIndexedAccess`). */
function at(values: readonly number[], index: number): number {
  return values[index] ?? 0;
}

function round(value: number): string {
  return String(Number(value.toFixed(2)));
}
