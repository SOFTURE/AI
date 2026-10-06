import type { ReactNode } from "react";
import { cx, seriesClass } from "./class-names.js";

/**
 * A swatch's shape: `box` for an area, `dot` for a point, `line` for a solid series, `dashed` and
 * `dotted` for patterned ones. Two series that differ only by pattern need two different swatches.
 */
export type SwatchShape = "box" | "dot" | "line" | "dashed" | "dotted";

/** A legend swatch in a series slot's colour. Decorative: the label next to it names the series. */
export function LegendSwatch({ slot, shape = "line" }: { readonly slot: number; readonly shape?: SwatchShape }) {
  return <span aria-hidden="true" className={cx("sft-chart-swatch", `sft-chart-swatch-${shape}`, seriesClass(slot))} />;
}

/** One legend entry: a swatch and its label on one line. */
export function LegendItem({ swatch, children }: { readonly swatch: ReactNode; readonly children: ReactNode }) {
  return (
    <li className="sft-chart-legend-item">
      {swatch}
      <span>{children}</span>
    </li>
  );
}

/** The legend: a wrapping row of `LegendItem`s. */
export function Legend({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <ul className={cx("sft-chart-legend", className)}>{children}</ul>;
}
