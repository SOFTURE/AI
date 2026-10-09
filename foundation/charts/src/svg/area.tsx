import type { CSSProperties } from "react";
import { type ChartTone, cx, type DataAttributes, seriesColourClass, seriesColourStyle } from "./class-names.js";
import { type AreaPathOptions, areaPath, type PlotPoint } from "./geometry.js";

export interface AreaProps extends AreaPathOptions, DataAttributes {
  /** The upper edge in viewBox units, left to right. */
  readonly points: readonly PlotPoint[];
  /** A series colour (`seriesSlot(index)`); wins over `tone`. */
  readonly slot?: number;
  /** A role colour (`ChartTone`). */
  readonly tone?: ChartTone;
  /** An app colour that is no token (a CSS colour or `var(…)`); wins over `slot` and `tone`. */
  readonly color?: string;
  /** Fill opacity, 0–1; `--sft-chart-tint-opacity` by default. */
  readonly opacity?: number;
  /** Added to the package class. */
  readonly className?: string;
  /** Inline style, applied last. */
  readonly style?: CSSProperties;
}

/**
 * The filled shape of `areaPath`: under a line down to `baseline`, or a band between two edges. Tinted in its slot's,
 * tone's or app colour (series 1 without any), so a `SeriesLine` drawn on its edge stays readable.
 */
export function Area({ points, baseline, curve, slot, tone, color, opacity, className, style, ...data }: AreaProps) {
  const inline: CSSProperties = { ...seriesColourStyle(color), fillOpacity: opacity, ...style };
  const hasStyle = Object.values(inline).some((value) => value !== undefined);
  const options: AreaPathOptions = { ...(baseline === undefined ? {} : { baseline }), ...(curve === undefined ? {} : { curve }) };
  return (
    <path
      {...data}
      className={cx("sft-chart-area", seriesColourClass({ slot, tone }), className)}
      style={hasStyle ? inline : undefined}
      d={areaPath(points, options)}
    />
  );
}
