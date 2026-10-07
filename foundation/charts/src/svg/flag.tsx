import type { CSSProperties, ReactNode } from "react";
import { cx, type DataAttributes } from "./class-names.js";
import { edgeAlign, percent } from "./geometry.js";

/**
 * A flag's look: `flag` is `--sft-chart-flag` with `--sft-chart-on-flag` text; `ink` the text colour with the page
 * colour as text, readable on any surface; `outline` text-coloured on the surface with an axis border.
 */
export type ChartFlagVariant = "flag" | "ink" | "outline";
export type ChartFlagSize = "sm" | "md";

export interface ChartFlagProps extends DataAttributes {
  /**
   * Position across the plot, in percent of its width. Given, the flag sits at the top of the plot there, aligned
   * to an edge near it (`edgeAlign`); omitted, the flag is not positioned and the parent places it.
   */
  readonly xPercent?: number;
  readonly variant?: ChartFlagVariant;
  readonly size?: ChartFlagSize;
  /** Added to the package classes. */
  readonly className?: string;
  /** Inline style, applied after the position. */
  readonly style?: CSSProperties;
  readonly children: ReactNode;
}

/**
 * A flag: a chip over an event, in the same look in both themes. Goes in `ChartPlot`'s overlay; the guide under it
 * is a `GuideLine`. Near an edge it aligns to the edge, or it would leave the card.
 */
export function ChartFlag({ xPercent, variant = "flag", size = "md", className, style, children, ...data }: ChartFlagProps) {
  const isPlaced = xPercent !== undefined;
  const classes = cx(
    "sft-chart-flag",
    isPlaced ? `sft-chart-align-${edgeAlign(xPercent)}` : "sft-chart-flag-free",
    variant !== "flag" && `sft-chart-flag-${variant}`,
    size !== "md" && `sft-chart-flag-${size}`,
    className,
  );
  const inline = isPlaced ? { left: percent(xPercent), ...style } : style;
  return (
    <span {...data} className={classes} style={inline}>
      {children}
    </span>
  );
}
