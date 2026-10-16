---
change_id: billing-lifetime-grant-539
reviewed: 2026-10-16
verdict: approved
---

# Plan review: billing-lifetime-grant-539

Checked plan.md against change.md, research.md, issue #539 and `grants.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The revoke button's label and the history title would show the raw id `_lifetime`. | Taken: the page names the plan-less grant "Lifetime access" (`admin.history.lifetime`). |
| 2 | Check | A reserved id equal to a valid plan id (`lifetime`) would collide with a declared lifetime plan. | No change; `_lifetime` fails `PLAN_ID_PATTERN`. |
| 3 | Check | Removing `admin.noPlans` could break an app's message overrides. | Taken: the key stays, with new text. |
| 4 | Check | Usage limits of a plan-less lifetime fall back to `paid.limits`. | No change; documented. |

No Critical findings.
