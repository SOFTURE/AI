---
change_id: jobs-failure-hooks-653
reviewed: 2026-10-22
verdict: approved
---

# Implementation review: jobs-failure-hooks-653

Checked the diff (d249e32, a66d20a) against change.md, plan.md and issue #653.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance 1: tests cover `failJob`, an `Err` on the last of three attempts (no call on attempts 1-2), an invalid payload, an exhausted lease (one call over two later claims), and no call on success; events compared exactly, the payload's secret never appears. | Met. |
| 2 | Check | Acceptance 2: `failing` once over two failed periods, then `healthy` on success; `late` exactly one millisecond past two periods, once over repeated checks, then `healthy`; two racing checks report once. | Met. |
| 3 | Check | Acceptance 3: a throwing `onJobFailed` leaves the job `failed` with its code and the report unchanged, and is logged as `the onJobFailed hook failed` with ids; a rejecting `onScheduleStateChanged` is logged and the transition stays taken. | Met. |
| 4 | Check | Acceptance 4: `recordJobHooks()` in `/testing`, used by every hook test. | Met. |
| 5 | Minor | The README example enqueues an alert job from `onJobFailed`; a failing alert job would enqueue another alert forever. | Fixed: the example skips its own alert queue, with a comment. |
| 6 | Minor | The worker's check first ran after its claims, so a job finishing during the round raced the check (seen in the worker test). | Fixed in p1: the check runs before the claims each round. |
| 7 | Check | Hooks run after the transaction returns (`completeJob`, `failExhaustedLeases`), never inside it; without hooks no extra queries run. | No change. |
| 8 | Check | Migration 0005 is forward-only with a rollback note and a check constraint; the Drizzle column has the same default. | No change. |
| 9 | Check | No Polish, no new dependency; `completeJob`'s new argument and `claimJobs`' `logger` are optional, so callers compile unchanged. | No change. |

Gates: typecheck, ESLint and the language gate green in pre-commit; jobs tests 180 passed (13 new), the hook file
three runs in a row.
