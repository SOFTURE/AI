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
 * leave the card. One threshold for every chart: 18 % and 82 % (FIRE_TRACKER RD-5).
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

function round(value: number): string {
  return String(Number(value.toFixed(2)));
}
