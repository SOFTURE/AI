---
change_id: jobs-failure-hooks-653
status: in_progress
---

# Plan: hooks for failed jobs and schedule health (issue #653)

Input: change.md, research.md. Complexity: medium (two hooks, one migration, worker wiring, test helper, docs).

## Phase 1: hooks, migration and wiring (TDD)

Files: `modules/jobs/src/contract.ts`, `src/options.ts`, `src/index.ts`, `src/schema.ts`,
`migrations/0005_add_schedule_reported_state.sql`, `src/server/hooks.ts` (new), `src/server/claim.ts`,
`src/server/process.ts`, `src/server/run-due.ts`, `src/server/index.ts`, `src/worker/run-job-worker.ts`,
`src/testing/index.ts`, `tests/hooks.test.ts` (new).

1. Tests first (`tests/hooks.test.ts`):
   - `onJobFailed` once for `failJob`, for an `Err` on the last attempt, for an invalid payload, for an exhausted lease;
     never for a retried attempt or a success; event `{ queue, jobId, code, attempts, at }` exactly.
   - A throwing hook: job still `failed`, error logged with the hook name, `runDueJobs` report unchanged.
   - `onScheduleStateChanged`: failing on the first terminal failure, no repeat on the second, `healthy` after a
     success, `late` when no run succeeded for two periods, nothing without a transition; two checks racing report once.
   - The worker reports a failing schedule (runJobWorker with a test clock).
   - The test helper records both hooks.
2. Types `JobFailedEvent`, `ScheduleHealth`, `ScheduleStateChangedEvent`, `OnJobFailedHook`,
   `OnScheduleStateChangedHook`; options `onJobFailed`, `onScheduleStateChanged` (`z.custom` functions).
3. Migration 0005: `reported_state text NOT NULL DEFAULT 'healthy'` with a check constraint.
4. `server/hooks.ts`: `notifyJobFailed` and `checkScheduleStates` (exported from `/server`), both catching hook errors.
5. `claimJobs` (lease expiry) and `completeJob` fire `onJobFailed` after their transaction; optional `logger`.
6. Worker: `checkScheduleStates` once a minute; `runDueJobs`: once at the end.
7. `@softure-ai/jobs/testing`: `recordJobHooks()`.

## Phase 2: docs

`modules/jobs/README.md` (options table, a section on alert hooks, testing helper), `modules/jobs/CHANGELOG.md`
`## Unreleased` with the migration note.

## Progress

- [ ] Phase 1: hooks, migration and wiring
- [ ] Phase 2: docs
