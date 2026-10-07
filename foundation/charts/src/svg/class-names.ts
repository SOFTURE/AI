import { SERIES_SLOTS } from "../palette/series-tokens.js";

/** Class names joined, skipping empty ones. */
export function cx(...names: readonly (string | false | undefined)[]): string {
  return names.filter(Boolean).join(" ");
}

/** The series colour slot (1-based) of the series at `index`. */
export function seriesSlot(index: number): number {
  return (((index % SERIES_SLOTS) + SERIES_SLOTS) % SERIES_SLOTS) + 1;
}

/** The class that sets `--sft-chart-series` for a slot from `seriesSlot`. */
export function seriesClass(slot: number): string {
  return `sft-chart-series-${String(slot)}`;
}

/** `data-*` attributes a primitive passes through to its element, for an app's tests and hooks. */
export interface DataAttributes {
  readonly [attribute: `data-${string}`]: string | number | boolean | undefined;
}

/**
 * A role colour for a line or marker, read from an existing token: `cursor`, `axis`, `grid` and `flag` from the
 * chart tokens, the rest from the colour roles of @softure-ai/ui. An app colour that is no token goes in `style`.
 */
export type ChartTone = "cursor" | "axis" | "grid" | "flag" | "foreground" | "muted" | "accent" | "danger" | "success" | "warning";

/** The class that sets `--sft-chart-tone` for a tone. */
export function toneClass(tone: ChartTone): string {
  return `sft-chart-tone-${tone}`;
}
