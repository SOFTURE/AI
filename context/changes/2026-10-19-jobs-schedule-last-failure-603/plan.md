---
change_id: jobs-schedule-last-failure-603
status: in_progress
---

# Plan: last failure of a scheduled queue (issue #603)

Input: change.md, research.md. Complexity: small (one migration, two write paths, one read, tests, docs).

## Phase 1: record and report the last failure (TDD)

Files: new `modules/jobs/migrations/0003_add_schedule_failures.sql`, `modules/jobs/src/schema.ts`,
`modules/jobs/src/server/schedules.ts`, `modules/jobs/src/server/claim.ts`, `modules/jobs/tests/schedules.test.ts`.

1. Tests first (in "schedule state in getQueueStats"):
   - no runs yet: `lastFailedAt: null`, `lastFailureCode: null`, `isFailing: false`;
   - success only: failure fields null, `isFailing: false`;
   - a failure after a success: `lastFailedAt` = the failure time, `lastFailureCode` = the handler's code,
     `isFailing: true`, `lastSucceededAt` unchanged;
   - a success after a failure: `isFailing: false`, the failure fields kept;
   - a retried attempt that later succeeds records no failure;
   - an expired lease with no attempts left records `jobs.lease_expired`.
   Update the existing `toEqual` expectations to the new shape.
2. Migration 0003: `ALTER TABLE schedules ADD COLUMN last_failed_at timestamptz, ADD COLUMN last_failure_code text`,
   with a rollback comment. Drizzle view gets both columns.
3. `recordScheduleFailure(ctx, queue, code)` next to `recordScheduleSuccess`; `completeJob` calls it for
   `kind: "failed"` in the same transaction; `failExhaustedLeases` calls it when it failed any row (same transaction).
4. `ScheduleState` gains `lastFailedAt`, `lastFailureCode`, `isFailing` (`lastFailedAt !== null && (lastSucceededAt ===
   null || lastFailedAt > lastSucceededAt)`).

## Phase 2: docs

`modules/jobs/README.md` (the `getQueueStats` schedule paragraph with the failing rule and a freshness example),
`modules/jobs/CHANGELOG.md` `## Unreleased` with the app's migration steps (run migrations, drop the read log).

## Progress

- [ ] Phase 1: record and report the last failure
- [ ] Phase 2: docs
