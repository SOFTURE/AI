---
change_id: db-drizzle-after-ledger-534
reviewed: 2026-10-16
verdict: approved
---

# Implementation review: db-drizzle-after-ledger-534

Reviewed: the branch diff against plan.md, change.md and issue #534.
Verdict: **approve**.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The default ledger stays `drizzle.__drizzle_migrations`; the #404 drizzle tests pass unchanged, so a `before`-only app re-applies nothing. | No change. |
| 2 | Check | The `after` fixture is a day older than the `before` one, so the separate-ledger test fails on a shared ledger (it is the issue's failure). | No change. |
| 3 | Check | The refusal runs next to the baseline check, before the lock and any hook, in `migrate` and `planMigrations`; the test shows no app table and no `drizzle` schema after it. | No change. |
| 4 | Check | Hand-written hooks carry no ledger and are never refused; `drizzle.ts` imports only a type from the migrator, so no import cycle at run time. | No change. |
| 5 | Check | Docs: doc comment, README example and paragraph, CHANGELOG `## Unreleased` with the step for an app already on a shared ledger (plan review finding 1). | No change. |

Gates: see plan.md Progress.
