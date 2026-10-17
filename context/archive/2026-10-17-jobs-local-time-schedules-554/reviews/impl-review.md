---
change_id: jobs-local-time-schedules-554
reviewed: 2026-10-17
verdict: approved
---

# Implementation review: jobs-local-time-schedules-554

Checked the diff (7ccfb84, 21b5edd) against change.md, plan.md and issue #554.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance 1: `enqueues a local-time schedule once per listed time, across a DST change` drives `runDueJobs` twice per 15-minute tick over 2026-10-24/26 and gets exactly five runs at the local 09:00/21:00 slots. | Met. |
| 2 | Check | Acceptance 2: the period tests and the `{ every }` option tests pass unchanged; the six packages that ship `{ every }` schedules typecheck. | Met. |
| 3 | Check | Acceptance 3: the README Schedules example shows the reminder schedule; the CHANGELOG lists the app's migration steps. | Met. |
| 4 | Check | The slot is monotonic in `now`: a minute-by-minute walk over both DST changes asserts it never moves back and never passes `now`, which the worker's settled-slot cache and the `last_slot_at < slot` upsert rely on. | No change. |
| 5 | Minor | `JobSchedulesInput` (the zod input type) allows `{}` at compile time; the schema refuses it at startup with "set either every or at, not both". | Keep: same pattern as the other option refinements. |
| 6 | Check | The worker computes slots every poll; the `Intl.DateTimeFormat` per zone is cached and a slot is six conversions. | No change. |

Gates: `npm run typecheck`, ESLint and the language gate green in pre-commit; jobs tests 99 passed.
