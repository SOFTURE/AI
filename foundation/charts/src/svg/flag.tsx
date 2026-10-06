import type { ReactNode } from "react";
import { cx } from "./class-names.js";
import { edgeAlign, percent } from "./geometry.js";

/**
 * A flag: a chip at the top of the plot over an event, in `--sft-chart-flag` with
 * `--sft-chart-on-flag` text in both themes. Near an edge it aligns to the edge (`edgeAlign`), or it
 * would leave the card. Goes in `ChartPlot`'s overlay; the guide under it is a `GuideLine`.
 */
export function ChartFlag({ xPercent, children }: { readonly xPercent: number; readonly children: ReactNode }) {
  return (
    <span className={cx("sft-chart-flag", `sft-chart-align-${edgeAlign(xPercent)}`)} style={{ left: percent(xPercent) }}>
      {children}
    </span>
  );
}
