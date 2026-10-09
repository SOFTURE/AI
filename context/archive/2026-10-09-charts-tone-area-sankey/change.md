---
change_id: charts-tone-area-sankey
title: "charts: tone and colour on legend swatches and series lines, an Area primitive, Sankey and BarList (issue #321)"
status: archived
roadmap_item: null
issue: 321
branch: claude/project-thread-trpx73
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

An adopting app drops its own legend, its raw `<path d={areaPath(...)}>` fills, its hand-built two-sided Sankey and
its labelled horizontal bars, and uses the package for all of them:

1. `LegendSwatch` and `SeriesLine` take `tone` and `color` next to `slot` (a slot stays optional on `SeriesLine`);
   `LegendSwatch` and `LegendItem` take `faded`; `LegendItem` renders as `li`, `div` or `span`, so it can sit outside
   `Legend`'s `<ul>`; `SeriesLine` takes `pattern` (`solid`, `dashed`, `dotted`).
2. `Area`: a filled `areaPath` in a slot, tone or colour.
3. `ChartToneName` (an alias of `ChartTone`) and `CHART_TONES` (the tone list), so an app with its own `ChartTone`
   type imports the package's under another name and can extend the list.
4. `layoutSankey(items, options)`: a two-sided (in → hub → out) layout with gaps between nodes and labels spread to a
   minimum spacing; `Sankey` draws it with `solid`, `tint` and `hatch` fills and HTML labels.
5. `BarList`: labelled horizontal bars (width = value / max) with value text, and `renderBarListHtml` with the same
   markup as a string, for a server renderer outside React (a blog body).

Without the new options, every existing component renders the same markup. A reviewer checks
`foundation/charts/tests/adoption-gaps-321.test.tsx`, the new rules in `styles.css`, the README and CHANGELOG `0.1.7`.

## Context

Issue [#321](https://github.com/SOFTURE/AI/issues/321). Lines and markers take `tone` since 0.1.3, swatches and series
lines only a `slot`. `areaPath` exists since 0.1.5 without a component. The adopting app keeps about 490 lines of
Sankey geometry and 150 lines of bar lists.

## Constraints

- Only `foundation/charts` and this folder.
- Backwards compatible: new props optional; `SeriesLine.slot` turning optional widens the type only.
- Colours stay tokens (the architecture test): new opacities are local custom properties with a fallback, an app
  colour comes in `color`, set as `--sft-chart-series` inline.
- Labels are HTML, never SVG text (the plot stretches). The Sankey drawing is hidden from assistive technology like
  every plot: the app pairs it with `ChartDataTable`. The bar list is a real list with its text.
- Another thread (#312) may change `src/scale/time-zone.ts`; no file here overlaps.
- English only.

## Notes

- Research: skipped as a separate artefact; the issue names the gaps and `plan.md` § Findings holds the reading of
  the package.
- Framing: skipped; the issue states the gaps and proposals.
- Placement: unlinked (`roadmap_item: null`, `issue: 321`), one GitHub issue is one change.

## Decisions (auto)

- Naming (point 3): keep `ChartTone` (renaming breaks every app) and add the alias `ChartToneName` plus `CHART_TONES`.
  An "extendable map" of tones would need a token per app tone; an app colour that is no token goes in `color`.
- A slot wins over a tone, a `color` wins over both (it is set inline), as on the cursor values of 0.1.6.
- Sankey shape: inputs on the left, one hub in the middle, outputs on the right; each node has one ribbon to the hub.
  Arbitrary node-to-node links are out of scope (the issue asks for a two-sided layout).
- Hatch is an SVG `<pattern>` per hatched node (its colour comes from the node's class, which a shared pattern could
  not read), with ids from `useId`.
- `BarList` takes string labels (shared with the HTML renderer); a value bar is `aria-hidden`, the text carries it.
- A version bump to 0.1.7 rides this change; the release goes out with the coordinator's next wave.
