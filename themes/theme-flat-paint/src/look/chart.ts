import type { DataRole } from "./roles.js";

/** The theme's flags: the lime chip, and the deep one for a variant date (e.g. in a simulation). */
export type ChartFlagLook = "accent" | "deep";

/** The sizes of `@softure-ai/charts`' `ChartFlag`. */
export type ChartFlagSize = "sm" | "md";

/** The variants of `@softure-ai/charts`' `ChartPin`. */
export type ChartPinVariant = "flag" | "ink";

/** The sizes of `@softure-ai/charts`' `ChartPin`. */
export type ChartPinSize = "sm" | "md" | "lg";

/** Where a chart sits, as `@softure-ai/charts`' `ChartSurfaceName`. */
export type ChartSurface = "page" | "dark" | "paper";

/** The tones of `@softure-ai/charts` (`ChartToneName`) the theme's roles map onto. */
export type ChartTone = "success" | "warning" | "danger" | "accent" | "muted";

/** A colour role on a chart: a data role, the accent and the secondary text colour. */
export type ChartRole = DataRole | "accent" | "muted";

/**
 * The flag's fill and text, for `ChartFlag variant="flag"` `className`: flat lime with ink text in both schemes, or
 * the deep green with white text. Both hold 4.5:1 (`tests/contrast.test.ts`).
 */
export const CHART_FLAG_VARIANT_LOOK: Readonly<Record<ChartFlagLook, string>> = {
  accent: "bg-accent-fill text-on-accent",
  deep: "bg-lime-deep text-paper",
};

/** The flag's radius, padding and type per `ChartFlag` size; one line, bold, tabular figures. */
export const CHART_FLAG_SIZE_LOOK: Readonly<Record<ChartFlagSize, string>> = {
  md: "rounded-md px-2 py-1 text-xs whitespace-nowrap font-bold tabular-nums",
  sm: "rounded-flag px-1.5 py-0.5 text-[0.6875rem] whitespace-nowrap font-bold tabular-nums",
};

/** The Flat Paint look of a flag of a look and size, for `ChartFlag`'s `className`. */
export function getChartFlagLook(look: ChartFlagLook, size: ChartFlagSize): string {
  return `${CHART_FLAG_VARIANT_LOOK[look]} ${CHART_FLAG_SIZE_LOOK[size]}`;
}

/**
 * The pin's parts, for `ChartPin` `classNames`: the dot's fill by variant and size by size, the dot's ring by the
 * chart's surface (lime on white does not hold 3:1, so the ring carries it), and the event line by surface. charts
 * draws the dash itself, so the line look colours that dash (`--sft-chart-pin-line`, the chart axis at 60 %, 70 % on
 * paper) instead of adding a border.
 */
export const CHART_PIN_LOOK = {
  dot: { flag: "bg-lime", ink: "bg-lime-deep" } satisfies Readonly<Record<ChartPinVariant, string>>,
  size: { sm: "size-2.5", md: "size-3", lg: "size-4" } satisfies Readonly<Record<ChartPinSize, string>>,
  ring: { page: "border-foreground", dark: "border-ink", paper: "border-paper" } satisfies Readonly<Record<ChartSurface, string>>,
  line: {
    page: "[--sft-chart-pin-line:color-mix(in_oklab,var(--sft-chart-axis)_60%,transparent)]",
    dark: "[--sft-chart-pin-line:color-mix(in_oklab,var(--sft-chart-axis)_60%,transparent)]",
    paper: "[--sft-chart-pin-line:color-mix(in_oklab,var(--sft-chart-axis)_70%,transparent)]",
  } satisfies Readonly<Record<ChartSurface, string>>,
} as const;

/** Each chart role as the `@softure-ai/charts` tone that paints it: the chart counterpart of `ROLE_TONE`. */
export const CHART_ROLE_TONE: Readonly<Record<ChartRole, ChartTone>> = {
  accessible: "success",
  locked: "warning",
  debt: "danger",
  accent: "accent",
  muted: "muted",
};
