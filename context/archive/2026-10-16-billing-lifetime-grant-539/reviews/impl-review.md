---
change_id: billing-lifetime-grant-539
reviewed: 2026-10-16
verdict: approved
---

# Implementation review: billing-lifetime-grant-539

Reviewed: the branch diff against plan.md, change.md and issue #539.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | `grantPlanManually` keeps its validation order and errors; the shared `recordManualGrant` holds the same lock order and the pin rollback on a closed request. Existing grant, refund and lock tests pass unchanged. | No change. |
| 2 | Check | `grantLifetimeManually` cannot reach `plan_unknown` / `request_closed`; they throw as bugs instead of widening its error type. | No change. |
| 3 | Check | The action branches on the reserved id before `findPlan`, so an unknown plan id is still `billing.plan_unknown`. | No change. |
| 4 | Check | The history row, the revoke label and the notice read "Lifetime access", never `_lifetime` (pages test). | No change. |
| 5 | Check | Docs: README (admin page, server functions, scripts, limitations), CHANGELOG `## Unreleased`. | No change. |

Gates: see plan.md Progress.
