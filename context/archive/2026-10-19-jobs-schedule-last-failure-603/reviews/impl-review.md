---
change_id: jobs-schedule-last-failure-603
reviewed: 2026-10-19
verdict: approved
---

# Implementation review: jobs-schedule-last-failure-603

Checked the diff (3059a8e..f65b83e) against plan.md, plan-review.md and issue #603.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every terminal failure path records the schedule: `completeJob` `failed` (retries used up, `failJob`, `jobs.invalid_payload`, a throw on the last attempt) and `failExhaustedLeases`. `releaseJob` and retries do not. | Covered by tests (handler failure, lease expiry, retry then success). |
| 2 | Check | `failExhaustedLeases` now runs in a transaction (plan review #1); it is called on the top-level `ctx.db`, and drizzle nests a transaction as a savepoint if a caller ever passes one. | No change. |
| 3 | Check | `isFailing` uses a strict `>`, so equal timestamps read as not failing (plan review #2). | No change. |
| 4 | Minor | Phase 2 (docs) landed in the phase 1 commit instead of its own. | Recorded under Progress; no functional effect. |
| 5 | Check | Migration 0003 is additive (two nullable columns) with a rollback note; README §5 and the CHANGELOG name it. | No change. |

Gates: `npm run typecheck`, `npm run lint`, jobs tests (103) green; the full `npm test` runs on push.

No Critical or Major findings.
