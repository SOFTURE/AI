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
  /**
   * The row from the top, 0 by default: a row lower by one chip height and a small space, e.g. from `layoutFlags`.
   * Read when the flag is placed by `xPercent`.
   */
  readonly row?: number;
  /**
   * How many rows the chip is tall, a whole number of at least 1 (e.g. 2 for a two-line chip, as given to
   * `layoutFlags`). Default 1. Above 1, the chip is as tall as its rows and `row` still moves it by one row per row.
   */
  readonly rows?: number;
  /** A tooltip, e.g. the labels a "+N" chip stands for. */
  readonly title?: string;
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
export function ChartFlag({ xPercent, variant = "flag", size = "md", row = 0, rows = 1, title, className, style, children, ...data }: ChartFlagProps) {
  if (!Number.isInteger(rows) || rows < 1) throw new RangeError(`ChartFlag: rows must be a whole number of at least 1 (got ${String(rows)}).`);
  const isPlaced = xPercent !== undefined;
  const isStacked = isPlaced && row !== 0;
  const isSpanning = rows > 1;
  const classes = cx(
    "sft-chart-flag",
    isPlaced ? `sft-chart-align-${edgeAlign(xPercent)}` : "sft-chart-flag-free",
    variant !== "flag" && `sft-chart-flag-${variant}`,
    size !== "md" && `sft-chart-flag-${size}`,
    className,
    isStacked && "sft-chart-flag-stacked",
    isSpanning && "sft-chart-flag-span",
  );
  const rowStyle = isStacked ? ({ "--sft-chart-flag-row": row } as CSSProperties) : undefined;
  const spanStyle = isSpanning ? ({ "--sft-chart-flag-rows": rows } as CSSProperties) : undefined;
  const inline = isPlaced ? { left: percent(xPercent), ...rowStyle, ...spanStyle, ...style } : { ...spanStyle, ...style };
  return (
    <span {...data} title={title} className={classes} style={inline}>
      {children}
    </span>
  );
}
