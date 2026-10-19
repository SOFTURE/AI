---
change_id: charts-flag-row-span-592
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: charts-flag-row-span-592

Checked the diff of `flag-layout.ts`, `flag.tsx`, `styles.css`, the two new test files, README and CHANGELOG against
change.md and plan.md.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | `--sft-chart-flag-pad-y: 0` on `sm` chips made the span's `min-height` invalid: `calc()` cannot add a unitless 0 to a length, so a spanning `sm` chip would lose its height. | Set to `0px`; a test pins it. |
| 2 | Check | Every `layoutFlags` and `ChartFlag` test from #559 passes unchanged; `rows: 1` gives the same layout and markup as no `rows`. | No change. |
| 3 | Check | Unset `--sft-chart-flag-rows` falls back to 1 in the stacked offset, so one-row chips move exactly as before. | No change. |
| 4 | Check | A flag taller than `maxRows`, or whose span would end below it, is hidden and counted; `FlagLayout.rows` equals the lowest spanned row plus one (property test). | No change. |
| 5 | Minor | An `outline` chip is a border taller than the row unit, so an outline chip spanning rows is a border short of its slot. | Accepted: the only outline chip is the one-row "+N" chip; noted in research.md. |
| 6 | Check | New local custom properties are added to the token allowlist in `architecture.test.ts`, not loosened elsewhere. | No change. |

No Critical findings.
