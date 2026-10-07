import type { CSSProperties } from "react";
import { cx, type DataAttributes, seriesClass } from "./class-names.js";
import { percent } from "./geometry.js";

/** The dot's fill: `flag` is `--sft-chart-flag`, `ink` the text colour. A `slot` overrides both. */
export type ChartPinVariant = "flag" | "ink";
export type ChartPinSize = "sm" | "md" | "lg";
/**
 * The dot's ring: `axis` (the default) gives a light fill on a light card its 3:1; `surface` is the card colour, so
 * the dot cuts the line it sits on (on a dark band, where the fill is contrast enough).
 */
export type ChartPinRing = "axis" | "surface";

export interface ChartPinProps extends DataAttributes {
  /**
   * Position across the plot, in percent of its width (`toPercent` on the drawing's x). Omitted, the pin is not
   * positioned across and the parent places its column.
   */
  readonly xPercent?: number;
  /** Height of the point, in percent of the plot's height from the bottom. */
  readonly yPercent: number;
  /**
   * `false` draws the dot alone: where a `GuideLine` already marks the event, a second dashed line
   * would overlap it.
   */
  readonly line?: boolean;
  /** Fills the dot with a series colour (`seriesSlot(index)`) instead of the variant's. */
  readonly slot?: number;
  readonly variant?: ChartPinVariant;
  readonly size?: ChartPinSize;
  readonly ring?: ChartPinRing;
  /** Added to the package class of the pin's column. */
  readonly className?: string;
  /** Inline style of the pin's column, applied after the position. */
  readonly style?: CSSProperties;
}

/**
 * An event pin on a curve: a dashed vertical from the bottom of the plot up to a point and a dot on the
 * point. HTML in `ChartPlot`'s overlay, so the dot stays round however the plot stretches. Decorative:
 * the value belongs in the `ChartDataTable`.
 */
export function ChartPin({ xPercent, yPercent, line = true, slot, variant = "flag", size = "md", ring = "axis", className, style, ...data }: ChartPinProps) {
  const inline = xPercent === undefined ? style : { left: percent(xPercent), ...style };
  const dot = cx(
    "sft-chart-pin-dot",
    slot !== undefined && seriesClass(slot),
    variant !== "flag" && `sft-chart-pin-dot-${variant}`,
    size !== "md" && `sft-chart-pin-dot-${size}`,
    ring !== "axis" && `sft-chart-pin-dot-ring-${ring}`,
  );
  return (
    <span {...data} className={cx("sft-chart-pin", className)} style={inline} aria-hidden="true">
      {line && <span className="sft-chart-pin-line" style={{ height: percent(yPercent) }} />}
      <span className={dot} style={{ bottom: percent(yPercent) }} />
    </span>
  );
}
