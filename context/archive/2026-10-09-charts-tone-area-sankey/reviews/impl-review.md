# Implementation review: charts-tone-area-sankey

Reviewed: the diff of `foundation/charts` (class names, legend, lines, area, Sankey, bar list, styles.css, tests,
README, CHANGELOG, version) against `plan.md`, `change.md` and issue #321. Verdict: **approved**, no open findings.

## Plan conformance

| Item | Decision | Where | Evidence |
|---|---|---|---|
| Colour | D1 | `seriesColourClass`, `seriesColourStyle` | tests: swatch and line keep the slot markup; tone maps onto the series property; slot wins over tone; colour inline |
| Faded | D2 | `.sft-chart-faded` | tests: on a swatch and on an item |
| LegendItem | D3 | `as` | tests: `li` by default, `div` and `span` |
| Area | D4 | `src/svg/area.tsx` | tests: `areaPath` as `d`, baseline, curve, tone, fill opacity, class, data attributes |
| Tones | D5 | `CHART_TONES`, `ChartToneName` | test: the list and the alias |
| Layout | D6 | `layoutSankey` | tests: boxes, ribbons and label centres computed by hand; crowded labels at the top and bottom; negative and empty input; gap shrink |
| Sankey | D7 | `Sankey` | tests: hidden SVG, four ribbons, hub, node classes, a hatch pattern in the node's colour referenced by its fill, HTML labels at the layout's heights |
| BarList | D8 | `getBarListRows`, `BarList`, `renderBarListHtml` | tests: widths against the largest value and a given max, clamping, a zero max; the string renderer equals React's markup for three inputs, escapes text and a hostile colour |
| Docs | Phase 3 | README (primitives, Colour by meaning, Sankey, Bar list, adoption table); CHANGELOG `0.1.7`; version 0.1.7 | — |

The new tests were seen red (the exports did not exist) before the code, then green; the existing 168 chart tests
pass unchanged.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Suggestion | `.sft-chart-line` now falls back to series 1 when no `--sft-chart-series` is set; before, a line without a slot could not be written. | Accepted: only reachable through the new optional `slot`; documented in the CHANGELOG. |
| R2 | Suggestion | A hatch pattern stretches with the plot (`preserveAspectRatio="none"`), so its angle follows the box's aspect. | Accepted: a texture, not data; the stroke stays a hairline (`non-scaling-stroke`). |
| R3 | Suggestion | `Sankey` uses `useId`, a hook; it still renders on the server (React allows `useId` in server components). | Accepted. |

## Gates

`npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm test`, `npm run build`: green.
