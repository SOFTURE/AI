# Plan review: charts-tone-area-sankey

Reviewed: `plan.md` against `change.md`, issue #321 and the current `src/svg/legend.tsx`, `src/svg/lines.tsx`,
`styles.css` and `tests/architecture.test.ts`. Verdict: **approved with fixes applied**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| F1 | Warning | Routing `SeriesLine`'s slot through `getLineLook` would add `sft-chart-stroke-series` and change existing markup. | Fixed in D1: the slot class goes into the base class as before; only a tone adds `sft-chart-fill-tone`. A test pins the old markup. |
| F2 | Warning | One shared hatch `<pattern>` cannot follow each node's colour: pattern content inherits from the pattern element, not from the shape that references it. | Fixed in D7: one pattern per hatched node, carrying the node's colour class; ids from `useId`, sanitised. |
| F3 | Warning | Different scales per side would make a ribbon's height differ at its two ends. | Fixed in D6: one scale for both sides and the hub. |
| F4 | Suggestion | `display: contents` on the bar rows would drop list semantics in some browsers. | Taken: rows are `subgrid` rows spanning the list's three columns. |
| F5 | Suggestion | `renderBarListHtml` through `react-dom/server` would pull the server renderer into app bundles. | Taken in D8: a plain string builder, pinned to the component's markup by a test. |
