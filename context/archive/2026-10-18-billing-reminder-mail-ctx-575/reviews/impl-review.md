---
change_id: billing-reminder-mail-ctx-575
reviewed: 2026-10-18
verdict: approved
---

# Implementation review: billing-reminder-mail-ctx-575

Checked the diff of 84f4dbe against plan.md and the acceptance of issue #575.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance 1: the new job test reads `auth.users` through `ctx.db` and the time through `ctx.clock` inside a `buildMail` passed to `createBillingJobHandlers`, and the mail carries both. | No change. |
| 2 | Check | Acceptance 2: `ctx` is a new field on the template's input only; no option changed, the existing `reminders` and `sendAccessReminders` tests pass unchanged apart from the exact-context assertion gaining `ctx`. | No change. |
| 3 | Check | `ctx` is typed as `ModuleContext<Queryable>`, the type `sendAccessReminders` already takes, so the template does not depend on `@softure-ai/jobs`. | No change. |
| 4 | Check | Phases 1 and 2 landed in one commit; both are small and recorded in Progress. | No change. |

No Critical findings.
