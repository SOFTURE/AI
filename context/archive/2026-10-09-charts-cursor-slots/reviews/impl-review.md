# Implementation review: charts-cursor-slots

Reviewed: the diff of `foundation/charts` (cursor, styles.css, tests, README, CHANGELOG, version) against `plan.md`,
`change.md` and issue #301. Verdict: **approved**, no open findings.

## Plan conformance

| Item | Decision | Where | Evidence |
|---|---|---|---|
| Readout | D1 | `ChartCursor` `renderReadout` | test: the app's markup is the status element's only content, with point and index; cleared on Escape |
| Active stop | D2 | `changeActive`, `onActiveChange` | test: keys, two pointer moves on one stop, Escape and blur give exactly `[0], [1], [2], [null]` |
| Frame | D3 | `frame`, `.sft-chart-cursor-box` | test: no `.sft-chart-frame`, one box with the app's plot and the layer, guide and dot at 50 % / 40 % from a pointer measured on the box; default keeps the frame |
| Colours | D4 | `getValueColourClass`, `.sft-chart-fill-tone` | test: tone + class, class alone, slot winning over tone, on dots and swatches alike |
| Placement | D5 | `readoutClassName` | test: appended to `sft-chart-readout`, absent by default |
| Docs | Phase 1 | README § Cursor, tables; CHANGELOG `0.1.6`; version 0.1.6 | — |

The new tests were seen red (5 failures) before the code, then green.

## Findings

| # | Severity | Finding | Decision |
|---|---|---|---|
| R1 | Suggestion | `onActiveChange` runs from event handlers, not an effect, so an app's `setState` there batches with the cursor's own. | Accepted: the intended behaviour; no extra render pass. |
| R2 | Suggestion | A value with neither `slot`, `tone` nor `className` gets no colour (the dot reads an unset `--sft-chart-series`). | Accepted: documented in the README; the type stays wide so an app's class alone can colour it. |

## Gates

`npm run typecheck`, `npm run lint` (ESLint and the language gate), `npm run build`: green; `npm test` runs in the
pre-push hook.
