// The series palette's tokens, in the order series take them (charts roadmap, CH-4). The colours live in
// @softure-ai/ui (`DEFAULT_THEME`); the measured order and margins are in this package's README ("Series palette").

/**
 * Series colour tokens, slot 1 first: brand, ink, purple, pink, blue, teal. Later slots are further from the
 * colours already used, so a chart with few series gets the widest margins.
 */
export const SERIES_TOKENS = [
  "chart-series-1",
  "chart-series-2",
  "chart-series-3",
  "chart-series-4",
  "chart-series-5",
  "chart-series-6",
] as const;

export type SeriesToken = (typeof SERIES_TOKENS)[number];

/**
 * How many series colours the tokens hold. A series index wraps around them, so a seventh series repeats the
 * first colour; tell such series apart by `dashed`.
 */
export const SERIES_SLOTS = SERIES_TOKENS.length;
