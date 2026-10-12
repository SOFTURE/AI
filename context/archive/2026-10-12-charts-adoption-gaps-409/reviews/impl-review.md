# Implementation review: charts-adoption-gaps-409

Reviewed: the branch diff against plan.md, change.md and issue #409.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Drift from plan: the event axis tests live in their own file (`tests/event-axis.test.tsx`) because they need `happy-dom`, while the rest of the issue's tests render on the server. | No change. |
| 2 | Check | Additive only: `LineChart` without `surface` renders `<figure class="sft-chart">` as before (tested); `ChartCursor` now imports `getNextIndex` from `cursor-keys.ts` and its existing tests pass untouched. | No change. |
| 3 | Check | `distinctColors` is independent of key order and keeps a key's colour when a key that sorts after it joins (tested); the README and the doc comment say a newcomer that sorts first can take a colour. | Wording tightened in `5c1d226`. |
| 4 | Check | `stackSeries` throws a `RangeError` naming the series whose x values differ; a stepped series must be stacked with series stepped at the same index (README). | No change. |
| 5 | Check | styles.css: new local properties (`--sft-chart-event-lanes`, `--sft-chart-event-lane`, `--sft-chart-event-lane-height`) are listed in the architecture test; no raw colours; components have no inline copy (the event axis label comes from `chartsMessages`, en and pl). | No change. |
| 6 | Check | Surfaces rely on @softure-ai/ui's `[data-theme]` rules, which match any element; asserted on `buildThemeCss(DEFAULT_THEME)`. The surface re-declares the text colour so labels follow its scheme. | No change. |
| 7 | Check | Docs: README sections Steps and stacked areas, Surfaces, Event axis, distinct colours under Colour by meaning, the adoption table; CHANGELOG `## Unreleased`; no version bump (batched releases). | No change. |

Gates: see plan.md Progress.
