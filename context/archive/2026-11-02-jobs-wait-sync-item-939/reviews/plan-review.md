---
change_id: jobs-wait-sync-item-939
reviewed: 2026-11-02
verdict: approved
---

# Plan review: jobs-wait-sync-item-939

Checked plan.md against change.md, research.md, issue #939 and `sync-items.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | The wait branch must come before the `attempt >= maxAttempts` rule, or an item at `maxAttempts - 1` fails. | Plan step 2 orders it first; a test pins the `maxAttempts - 1` case. |
| 2 | Minor | A new outcome kind breaks an app's exhaustive `switch` at compile time. | Accepted: it is the signal that the app should handle the new case; CHANGELOG says so. |
| 3 | Minor | `attempt` passed to the callback after a wait must not grow. | Plan step 4 tests that the next run gets the same attempt number. |

Verdict: approved.
