---
change_id: core-money-negative-zero
reviewed: 2026-10-12
verdict: approved
---

# Implementation review: core-money-negative-zero

Checked the diff against plan.md and change.md and ran the gates (typecheck, lint, test).

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The new test failed before the fix (`-0` printed with a minus) and passes after it. | No change. |
| 2 | Check | Every existing `formatMoney` expectation passes unchanged, so non-zero output is the same; `-50` rounded still prints `-PLN 1` and `-1` still prints `-0,01`. | No change. |
| 3 | Check | The `signed` path keeps `"exceptZero"`; compact `-0` prints `PLN 0`. | No change. |

No open findings.
