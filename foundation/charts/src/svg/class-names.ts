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
