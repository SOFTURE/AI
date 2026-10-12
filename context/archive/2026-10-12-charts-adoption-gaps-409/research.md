---
change_id: charts-adoption-gaps-409
---

# Research: charts-adoption-gaps-409

Sources: `foundation/charts/src/{svg,scale,cursor,messages}/*`, `foundation/charts/styles.css`,
`foundation/charts/tests/{architecture,cursor,adoption-gaps-378}.test.ts(x)`, `foundation/ui/src/theme/{tokens,theme-css}.ts`,
`foundation/ui/scripts/build-css.mjs`, `foundation/ui/README.md` ("Sections in a fixed scheme").

- **Step.** `smoothLinePath` already gives a straight vertical segment for two points with the same x, and `linePath`
  draws one trivially; a step is one extra point `{ x: points[i].x, y: points[i - 1].y }` before `i`. Points are plain
  `{ x, y }` (`PlotPoint` or `ChartPoint`), so a generic helper over `{ y }` serves both.
- **Colours.** Series take `seriesSlot(index)`, which depends on position, so a band's colour moves when another band
  appears. `SERIES_SLOTS` is 6. Nothing maps keys to colours.
- **Surfaces.** The chart CSS reads only `--sft-*` tokens. ui's compiled `styles.css` writes the default tokens per
  scheme under `[data-theme="light"]` and `[data-theme="dark"]` (`buildThemeCss` with `fallback: true`, inside
  `@layer softure`); the attribute selector is not tied to `:root`, so any element with `data-theme` gives its subtree
  that scheme's complete tokens, chart tokens included. ui's `schemeScopes` does the same for app selectors. The
  scheme rule also sets `color-scheme`.
- **Event axis.** `ChartCursor` is the only client component: a focusable `role="group"`, arrow/Home/End/Escape via
  `getNextIndex`, pointer snapping to the nearest x, a polite live readout (`sft-chart-readout*` classes). Its aria
  label comes from `messages` (`en`, `pl`). The architecture test scans `src/svg` and `src/cursor` for raw colours
  and inline copy, and checks every `var(--sft-…)` in styles.css against the tokens plus `LOCAL_PROPERTIES`.
- **Stacked areas.** `areaPath(upper, { baseline: lower })` already draws a band and `Area` forwards `baseline`.
  `peakOf`/`troughOf` take `getValue`, so totals for the y domain come from the stacked edges.
- Tests are vitest, React markup via `renderToStaticMarkup`, client components via `@testing-library/react` under
  `happy-dom`.
