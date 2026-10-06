// The point under a cursor. The cursor's pixel goes through the x scale's `invert` first, so the
// search and the drawing share one mapping (FIRE_TRACKER repeated the scale's formula here).
import { toNumber, type ChartPoint } from "./scale.js";

/**
 * The index of the point whose x is closest to `x`, in data space (`scale.invert(pixel)`), or `null`
 * for no points. Points may come in any order; of two equally close points the first wins. Positions
 * off either end give the edge point, never an index outside the array.
 */
export function nearestPointIndex(points: readonly Pick<ChartPoint, "x">[], x: Date | number): number | null {
  const target = toNumber(x);
  let best: number | null = null;
  let bestDistance = Infinity;
  points.forEach((point, index) => {
    const distance = Math.abs(toNumber(point.x) - target);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
}
