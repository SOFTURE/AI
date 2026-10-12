// Chart surfaces: the same chart on the page, on a dark band and on a paper card. The chart reads only tokens, and
// @softure-ai/ui scopes a whole colour scheme to any element with `data-theme`, so a surface is that attribute on the
// chart's root: grid, axis, labels and series all switch together, and nothing below needs a surface prop.
import type { ReactNode } from "react";
import { cx } from "./class-names.js";

/** Every chart surface, in order: a list an app can map over. */
export const CHART_SURFACES = ["page", "dark", "paper"] as const;

/**
 * Where a chart sits: `page` follows the page's theme, `dark` is a dark band (the dark scheme whatever the page
 * theme), `paper` a light card (the light scheme whatever the page theme).
 */
export type ChartSurfaceName = (typeof CHART_SURFACES)[number];

const SURFACE_SCHEMES: Readonly<Record<ChartSurfaceName, "light" | "dark" | undefined>> = {
  page: undefined,
  dark: "dark",
  paper: "light",
};

/** The attributes that put an element's subtree on a surface. */
export interface ChartSurfaceAttributes {
  readonly className: string;
  readonly "data-theme"?: "light" | "dark";
}

/**
 * The class (`sft-chart-surface sft-chart-surface-<name>`, a hook for an app's own tuning of a surface's tokens) and
 * the `data-theme` of a surface, for an element the app renders itself.
 */
export function getChartSurfaceAttributes(surface: ChartSurfaceName): ChartSurfaceAttributes {
  const scheme = SURFACE_SCHEMES[surface];
  const className = cx("sft-chart-surface", `sft-chart-surface-${surface}`);
  return scheme === undefined ? { className } : { className, "data-theme": scheme };
}

export interface ChartSurfaceProps {
  readonly surface: ChartSurfaceName;
  /** The element: `div` by default. */
  readonly as?: "div" | "section" | "span";
  /** Added to the surface classes. */
  readonly className?: string;
  readonly children?: ReactNode;
}

/** A wrapper that puts every chart part inside it on `surface`: `LineChart`, primitives, `EventAxis`, a `Sankey`. */
export function ChartSurface({ surface, as: Element = "div", className, children }: ChartSurfaceProps) {
  const attributes = getChartSurfaceAttributes(surface);
  return (
    <Element {...attributes} className={cx(attributes.className, className)}>
      {children}
    </Element>
  );
}
