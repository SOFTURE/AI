---
change_id: charts-flag-row-span-592
reviewed: 2026-10-19
verdict: approved
---

# Plan review: charts-flag-row-span-592

Checked plan.md against change.md, research.md, issue #592, `flag-layout.ts`, `flag.tsx` and `styles.css`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The issue says "nothing else changes", but `ChartFlag`'s offset uses the chip's own height, so a two-row chip in row 1 would move by two rows. | Phase 2 adds `rows` to `ChartFlag`; recorded under Decisions (auto). |
| 2 | Major | Changing `.sft-chart-flag-stacked` could move existing one-row chips. | Divide by `var(--sft-chart-flag-rows, 1)`: unset, the formula is the same value. The existing markup tests stay as they are. |
| 3 | Minor | Phase 2 step 1 left the invalid-`rows` behaviour open. | Throw a `RangeError`, consistent with `layoutFlags`. |
| 4 | Minor | `sm` chips have no vertical padding, so a fixed padding in the min-height would be wrong for them. | `--sft-chart-flag-pad-y` drives both the padding and the min-height. |
| 5 | Check | `rowEnds` as the per-row bound stays correct with spans (flags come in start order). | No change. |
| 6 | Check | Placement objects keep their shape, so `toEqual` oracles in apps and tests hold. | No change. |

No Critical findings.
