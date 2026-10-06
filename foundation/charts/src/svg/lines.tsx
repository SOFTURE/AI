// SVG lines of the plot, in viewBox units. Every stroke is `non-scaling-stroke` (styles.css): the
// plot stretches to its box and a line must stay as thin as its token says.
import { cx, seriesClass } from "./class-names.js";
import { linePath, PLOT_HEIGHT, PLOT_WIDTH, type PlotPoint } from "./geometry.js";

/** Horizontal grid lines, drawn before the series so they never cross them. */
export function GridLines({ ys, width = PLOT_WIDTH }: { readonly ys: readonly number[]; readonly width?: number }) {
  return (
    <>
      {ys.map((y) => (
        <line key={y} className="sft-chart-grid" x1={0} y1={y} x2={width} y2={y} />
      ))}
    </>
  );
}

/** The zero line at the bottom of the plot. */
export function Baseline({ y = PLOT_HEIGHT, width = PLOT_WIDTH }: { readonly y?: number; readonly width?: number }) {
  return <line className="sft-chart-baseline" x1={0} y1={y} x2={width} y2={y} />;
}

/** A guide's pattern: `dashed` for an event (a flag), `dotted` for a second-order marker. */
export type GuidePattern = "dashed" | "dotted";

export interface GuideLineProps {
  readonly x: number;
  readonly y1?: number;
  readonly y2?: number;
  readonly pattern?: GuidePattern;
}

/** A vertical guide from `y1` to `y2` (the whole height by default). The only place with its dash pattern. */
export function GuideLine({ x, y1 = 0, y2 = PLOT_HEIGHT, pattern = "dashed" }: GuideLineProps) {
  return <line className={cx("sft-chart-guide", `sft-chart-guide-${pattern}`)} x1={x} y1={y1} x2={x} y2={y2} />;
}

export interface SeriesLineProps {
  /** Points in viewBox units, in drawing order. */
  readonly points: readonly PlotPoint[];
  /** Colour slot, `seriesSlot(index)`. */
  readonly slot: number;
  readonly dashed?: boolean;
}

/** One series as a polyline in its slot's colour. */
export function SeriesLine({ points, slot, dashed = false }: SeriesLineProps) {
  return <path className={cx("sft-chart-line", seriesClass(slot), dashed && "sft-chart-line-dashed")} d={linePath(points)} />;
}
