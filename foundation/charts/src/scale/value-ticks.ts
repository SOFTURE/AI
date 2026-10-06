// Axis ticks: round steps under an unchanged peak (ported from FIRE_TRACKER `chart-ticks.ts`).
//
// The peak of the scale does not move. Ticks are multiples of a round step no higher than the
// peak, so lines, the cursor and the tooltip keep their geometry; only the grid lines are placed.
// Rounding the peak up would flatten the curve and need a second geometry for the cursor.

/** Step mantissas: 1, 2, 2.5, 5 × 10ⁿ, a sequence the eye reads as round. */
const MANTISSAS = [1, 2, 2.5, 5] as const;

/** Year steps: multiples that read as "every decade", "every five years". */
export const YEAR_STEPS = [1, 2, 5, 10, 20, 25, 50] as const;

/** Tolerance for floating point: 3 000 000 / 1 000 000 must count 3, not 2.9999999. */
const EPSILON = 1e-9;

/**
 * The candidate whose tick count is closest to the target; on a tie the larger step, since fewer
 * labels mean less clutter. `null` when no candidate yields a tick.
 */
export function pickStep(candidates: readonly number[], countOf: (step: number) => number, target: number): number | null {
  let best: { step: number; distance: number } | null = null;
  for (const step of candidates) {
    const count = countOf(step);
    if (count < 1) continue;
    const distance = Math.abs(count - target);
    if (best === null || distance < best.distance || (distance === best.distance && step > best.step)) {
      best = { step, distance };
    }
  }
  return best?.step ?? null;
}

interface ValueTickOptions {
  /**
   * The smallest step allowed, e.g. 1 when labels show whole units: a step of 0.25 would label
   * "0" under a line that is not at zero.
   */
  readonly minStep?: number;
}

/**
 * Grid line values in `(0, max]`, ascending, without zero (the baseline is drawn on its own).
 *
 * @param max the peak of the chart's scale (`peakOf`)
 * @param target roughly how many ticks to show
 */
export function valueTicks(max: number, target: number, { minStep = 0 }: ValueTickOptions = {}): number[] {
  if (!(max > 0) || target < 1) return [];
  const exponent = Math.floor(Math.log10(max / target));
  const candidates = [exponent - 1, exponent, exponent + 1]
    .flatMap((power) => MANTISSAS.map((mantissa) => mantissa * 10 ** power))
    .filter((step) => step >= minStep);
  const countOf = (step: number) => Math.floor(max / step + EPSILON);
  const step = pickStep(candidates, countOf, target);
  if (step === null) return [];
  return Array.from({ length: countOf(step) }, (_, index) => roundToStep((index + 1) * step, step));
}

/** Removes the floating point noise of a multiple (0.1 × 3 = 0.30000000000000004). */
function roundToStep(value: number, step: number): number {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1);
  return Number(value.toFixed(decimals));
}

/**
 * Round years (multiples of the step) after the start year and no later than the end year. The
 * start year is labelled by the chart on its own ("today"), so it is not a tick.
 */
export function yearTicks(startYear: number, endYear: number, target: number): number[] {
  if (endYear <= startYear || target < 1) return [];
  const first = (step: number) => Math.floor(startYear / step) * step + step;
  const countOf = (step: number) => Math.max(0, Math.floor((endYear - first(step)) / step) + 1);
  const step = pickStep(YEAR_STEPS, countOf, target);
  if (step === null) return [];
  return Array.from({ length: countOf(step) }, (_, index) => first(step) + index * step);
}
