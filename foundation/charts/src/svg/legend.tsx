import type { CSSProperties, ReactNode } from "react";
import { type ChartTone, cx, type DataAttributes, seriesColourClass, seriesColourStyle } from "./class-names.js";

/**
 * A swatch's shape: `box` for an area, `dot` for a point, `line` for a solid series, `dashed` and
 * `dotted` for patterned ones. Two series that differ only by pattern need two different swatches.
 */
export type SwatchShape = "box" | "dot" | "line" | "dashed" | "dotted";

export interface LegendSwatchProps extends DataAttributes {
  /** A series colour (`seriesSlot(index)`); wins over `tone`. */
  readonly slot?: number;
  /** A role colour (`ChartTone`), for a series coloured by meaning. */
  readonly tone?: ChartTone;
  /** An app colour that is no token (a CSS colour or `var(…)`); wins over `slot` and `tone`. */
  readonly color?: string;
  readonly shape?: SwatchShape;
  /** Dimmed, for a series that is hidden or out of focus. */
  readonly faded?: boolean;
  /** Added to the package class. */
  readonly className?: string;
  /** Inline style, applied last. */
  readonly style?: CSSProperties;
}

/** A legend swatch in a series slot's, a tone's or an app's colour. Decorative: the label next to it names the series. */
export function LegendSwatch({ slot, tone, color, shape = "line", faded = false, className, style, ...data }: LegendSwatchProps) {
  const inline = { ...seriesColourStyle(color), ...style };
  return (
    <span
      {...data}
      aria-hidden="true"
      className={cx("sft-chart-swatch", `sft-chart-swatch-${shape}`, seriesColourClass({ slot, tone }), faded && "sft-chart-faded", className)}
      style={Object.keys(inline).length > 0 ? inline : undefined}
    />
  );
}

/** The element a legend entry renders as: `li` inside `Legend`, `div` or `span` anywhere else. */
export type LegendItemElement = "li" | "div" | "span";

export interface LegendItemProps {
  readonly swatch: ReactNode;
  readonly children: ReactNode;
  /** `li` by default; `div` or `span` for an entry outside `Legend`'s list (a table header, a tooltip). */
  readonly as?: LegendItemElement;
  /** Dimmed, swatch and label alike. */
  readonly faded?: boolean;
  readonly className?: string;
}

/** One legend entry: a swatch and its label on one line. */
export function LegendItem({ swatch, children, as: Element = "li", faded = false, className }: LegendItemProps) {
  return (
    <Element className={cx("sft-chart-legend-item", faded && "sft-chart-faded", className)}>
      {swatch}
      <span>{children}</span>
    </Element>
  );
}

/** The legend: a wrapping row of `LegendItem`s. */
export function Legend({ children, className }: { readonly children: ReactNode; readonly className?: string }) {
  return <ul className={cx("sft-chart-legend", className)}>{children}</ul>;
}
