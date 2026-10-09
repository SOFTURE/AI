import type { CSSProperties } from "react";
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

/** Every `ChartTone`, in order: a list an app can map over or extend with its own names. */
export const CHART_TONES = ["cursor", "axis", "grid", "flag", "foreground", "muted", "accent", "danger", "success", "warning"] as const;

/**
 * A role colour for a line or marker, read from an existing token: `cursor`, `axis`, `grid` and `flag` from the
 * chart tokens, the rest from the colour roles of @softure-ai/ui. An app colour that is no token goes in `color` or
 * `style`.
 */
export type ChartTone = (typeof CHART_TONES)[number];

/** `ChartTone` under a name that does not collide with an app's own `ChartTone` type. */
export type ChartToneName = ChartTone;

/** The class that sets `--sft-chart-tone` for a tone. */
export function toneClass(tone: ChartTone): string {
  return `sft-chart-tone-${tone}`;
}

/** How a filled or stroked part reading `--sft-chart-series` is coloured. */
export interface SeriesColour {
  /** A series colour (`seriesSlot(index)`); wins over `tone`. */
  readonly slot?: number | undefined;
  /** A role colour (`ChartTone`). */
  readonly tone?: ChartTone | undefined;
}

/** The class that colours a part: its slot, else its tone mapped onto `--sft-chart-series`, else none. */
export function seriesColourClass({ slot, tone }: SeriesColour): string | undefined {
  if (slot !== undefined) return seriesClass(slot);
  return tone === undefined ? undefined : cx(toneClass(tone), "sft-chart-fill-tone");
}

/** An app colour that is no token, as an inline `--sft-chart-series`; it wins over a slot or a tone class. */
export function seriesColourStyle(color: string | undefined): CSSProperties | undefined {
  // A custom property is not a key of CSSProperties; React writes it to the style attribute as is.
  return color === undefined ? undefined : ({ "--sft-chart-series": color } as CSSProperties);
}
