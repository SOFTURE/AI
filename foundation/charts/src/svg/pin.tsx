import { cx, seriesClass } from "./class-names.js";
import { percent } from "./geometry.js";

export interface ChartPinProps {
  /** Position across the plot, in percent of its width (`toPercent` on the drawing's x). */
  readonly xPercent: number;
  /** Height of the point, in percent of the plot's height from the bottom. */
  readonly yPercent: number;
  /**
   * `false` draws the dot alone: where a `GuideLine` already marks the event, a second dashed line
   * would overlap it.
   */
  readonly line?: boolean;
  /** Fills the dot with a series colour (`seriesSlot(index)`) instead of the flag's. */
  readonly slot?: number;
}

/**
 * An event pin on a curve: a dashed vertical from the bottom of the plot up to a point and a dot on the
 * point. HTML in `ChartPlot`'s overlay, so the dot stays round however the plot stretches. Decorative:
 * the value belongs in the `ChartDataTable`.
 */
export function ChartPin({ xPercent, yPercent, line = true, slot }: ChartPinProps) {
  return (
    <span className="sft-chart-pin" style={{ left: percent(xPercent) }} aria-hidden="true">
      {line && <span className="sft-chart-pin-line" style={{ height: percent(yPercent) }} />}
      <span className={cx("sft-chart-pin-dot", slot !== undefined && seriesClass(slot))} style={{ bottom: percent(yPercent) }} />
    </span>
  );
}
