---
change_id: auth-forms-pending-label-616
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: auth-forms-pending-label-616

Checked the diff (357a431, 75df246) against change.md, plan.md and issue #616.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `FormShell` passes `pendingLabel={pendingLabel}` with children `submitLabel`, the issue's fix and `ActionForm`'s pattern; all five forms share it. | No change. |
| 2 | Check | Tests cover the idle reserve of all five forms and the pending state of `LoginForm` (busy, name = pending copy, reserve = submit copy); all six failed before the fix. | No change. |
| 3 | Check | The pending test settles its action in `finally`, so a failure cannot stall the other form tests under the shuffled order (seen while the test was red). | No change. |
| 4 | Check | Accessible names stay the visible label (the reserve is a CSS `::after`); existing tests that find buttons by submit copy pass. No new props, no copy, no dependency range change. | No change. |

No findings to fix. Gates: typecheck, lint (pre-commit), auth tests 412 passed three times.
