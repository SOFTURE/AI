import type { ReactNode } from "react";
import { cx } from "./class-names.js";
import { PLOT_HEIGHT, PLOT_WIDTH } from "./geometry.js";

export interface ChartPlotProps {
  /** SVG content in viewBox units (`PLOT_WIDTH` × `PLOT_HEIGHT`): grid, lines, guides. */
  readonly children?: ReactNode;
  /** HTML laid over the plot at percentages: axis labels, flags. */
  readonly overlay?: ReactNode;
  readonly className?: string;
}

/**
 * The plot: an SVG in a fixed viewBox stretched to the box (height from `--sft-chart-plot-height`,
 * width from the container), with hairline strokes. Labels are HTML in `overlay`, never SVG text,
 * which would stretch with the drawing. The SVG is hidden from assistive technology: the data
 * belongs in a `ChartDataTable`.
 */
export function ChartPlot({ children, overlay, className }: ChartPlotProps) {
  return (
    <div className={cx("sft-chart-plot", className)}>
      <svg
        className="sft-chart-svg"
        viewBox={`0 0 ${String(PLOT_WIDTH)} ${String(PLOT_HEIGHT)}`}
        preserveAspectRatio="none"
        aria-hidden="true"
        focusable="false"
      >
        {children}
      </svg>
      {overlay}
    </div>
  );
}
