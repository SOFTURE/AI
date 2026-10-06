// Test helpers of @softure-ai/charts: the series palette guard. Plain functions with no test-runner import;
// failures come back as values for `expect(...).toEqual([])`. Never imported by the package's runtime code, so
// they (and @softure-ai/ui/testing) stay out of app bundles.
export {
  checkSeriesPalette,
  SERIES_GROUNDS,
  type SeriesCollision,
  type SeriesPaletteFailure,
  type SeriesPaletteOptions,
} from "../palette/check-series-palette.js";
export { SERIES_TOKENS, type SeriesToken } from "../palette/series-tokens.js";
