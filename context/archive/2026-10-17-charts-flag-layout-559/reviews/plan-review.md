---
change_id: charts-flag-layout-559
reviewed: 2026-10-17
verdict: approved
---

# Plan review: charts-flag-layout-559

Checked plan.md against change.md, research.md, issue #559, `flag.tsx`, `line-chart.tsx` and `event-layout.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The issue's signature returns a bare array; the plan returns an object. An app drawing "+N" needs the hidden count and the rows used to size its band; deriving them from the array is easy to get wrong. | Keep the object; placements stay in input order, so `placements[i]` matches the issue's array. Recorded under Decisions (auto). |
| 2 | Major | Without `align`, a centred chip would be laid out as if it started at its x, and `LineChart`'s edge-aligned chips would collide anyway. | `align` is in the input; `LineChart` passes `edgeAlign(xPercent)`. |
| 3 | Minor | `translate` with a percentage resolves against the element's own box: right for a chip whose height is its row height. A `sm` chip is shorter, so its rows are tighter, which is wanted. | No change. |
| 4 | Check | Additive: no new required prop; `ChartFlag` without `row` emits the same markup (asserted). | No change. |
| 5 | Check | The "+N" copy goes through the message layer (`lineChart.moreFlags`), English only. | No change. |

No Critical findings.
