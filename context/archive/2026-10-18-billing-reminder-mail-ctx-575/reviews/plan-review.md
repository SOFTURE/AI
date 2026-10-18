---
change_id: billing-reminder-mail-ctx-575
reviewed: 2026-10-18
verdict: approved
---

# Plan review: billing-reminder-mail-ctx-575

Checked plan.md against change.md, research.md, issue #575, `reminder-mail.ts` and `jobs/index.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | The field is additive: existing templates ignore it and `sendAccessReminders` callers pass nothing new. | No change. |
| 2 | Check | In the job handler `ctx` is the job's own context, so `ctx.db` is the worker's handle (not a transaction) and `ctx.clock` the job's clock, as the acceptance asks. | No change. |
| 3 | Check | A dry run also calls `buildMail` with `ctx`; the existing "must not write" rule covers it and the README repeats it. | No change. |
| 4 | Check | The exact-object test changes by one expected field; nothing is loosened. | No change. |

No Critical findings.
