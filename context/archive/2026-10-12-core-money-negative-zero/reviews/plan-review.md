---
change_id: core-money-negative-zero
reviewed: 2026-10-12
verdict: approved
---

# Plan review: core-money-negative-zero

Checked plan.md against change.md, research.md, issue #375 and `foundation/core/src/format.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The issue's proposal normalizes `-0` only; `rounded` still prints `-PLN 0` for -0.4 units. | Accepted: decision 1 (`"negative"`) covers both; a test pins the rounded case. |
| 2 | Check | `"negative"` needs ECMA-402 2023; the packages require Node >= 22, where it is supported. | No change. |
| 3 | Check | Non-zero amounts keep their output: the existing tests stay unchanged and a negative non-zero case is pinned. | No change. |

No open Critical findings.
