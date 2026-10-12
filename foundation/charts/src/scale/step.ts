// A vertical jump in a series: the value holds until a point, then changes at that point's x (funds unlocking on a
// date, a price change). A polyline between two points always slopes, so the step needs one extra point.

/**
 * `points` with a vertical jump at `index`: a copy of the point there carrying the previous point's `y` goes in before
 * it, so the line runs flat up to that x and rises or falls straight. Every other field of the point is kept. The
 * first point, or an index outside the series (or not a whole number), has nothing to step from: an unchanged copy.
 */
export function withStepAt<P extends { readonly y: number }>(points: readonly P[], index: number): P[] {
  const point = points[index];
  const previous = points[index - 1];
  if (!Number.isInteger(index) || point === undefined || previous === undefined) return [...points];
  return [...points.slice(0, index), { ...point, y: previous.y }, ...points.slice(index)];
}
