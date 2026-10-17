---
change_id: billing-entitlement-sql-555
reviewed: 2026-10-17
verdict: approved
---

# Plan review: billing-entitlement-sql-555

Checked plan.md against change.md, research.md, issue #555 and `resolveEntitlement`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Passing the policy as arguments keeps the database free of configuration state; the TS helper removes the copy for SQL built in the app. | No change. |
| 2 | Minor | `at` and `timezone` are a keyword and a built-in function name in Postgres. | Name the parameters `as_of` and `time_zone`. |
| 3 | Minor | A set-returning SQL function declared `STRICT` is not inlined, so a filter on `user_id` would scan every account. | Keep the functions non-strict; `entitlement_state` filters `entitlement_states`. |
| 4 | Minor | Fixtures move an account between states; `updated_at >= created_at` must hold on the update. | Update `updated_at` to the later of the two. |
| 5 | Check | The property test covers a zone that skips midnight (America/Santiago) and a zero-day trial. | No change. |

No Critical findings.
