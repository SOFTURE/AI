---
change_id: jobs-progress-cancel-951
status: done
---

# Plan: jobs progress and cancel (issue #951)

Input: change.md, research.md. Complexity: medium (one migration, the claim/run path, admin API, page, docs).

## Phase 1: progress

Files: `migrations/0007_add_progress_and_cancel.sql` (new), `src/schema.ts`, `src/progress.ts` (new),
`src/contract.ts`, `src/handlers.ts`, `src/server/{job-row,claim,process}.ts`, `src/index.ts`,
`tests/progress.test.ts` (new).

1. Migration 0007: `jobs.jobs.progress jsonb` (object or null), `progress_at timestamptz`, `cancel_requested_at
   timestamptz` (only while `running` or once `cancelled`); `jobs.runs` outcome check gains `cancelled`.
2. `jobProgressSchema`: `{ step: code, done?: count, total?: count, code?: code }`, strict; `JobProgress` type.
3. `context.reportProgress(progress)`: checked (invalid: warning with paths, dropped), throttled to one write per
   second per attempt (a report inside the window is kept and written by the next report after it), fenced write of
   `progress` and `progress_at`; a database failure is logged as a warning, never thrown into the handler.
4. A new claim clears the previous attempt's progress. `Job` gains `progress`, `progressAt`, `cancelRequestedAt`.
5. Tests first: stored and returned by `getJob`/`listRecentJobs`, throttle, invalid progress dropped, fenced after a
   takeover, reset on the next attempt.

## Phase 2: cancelling a running job

Files: `src/server/{admin,claim,process,run-due}.ts`, `src/worker/run-job-worker.ts`, `src/contract.ts`,
`src/server/index.ts`, `tests/cancel.test.ts` (new), existing tests that assert a `runDueJobs` report.

1. `requestJobCancel(ctx, id)`: pending → `cancelled` (as `cancelJob`); running → `cancel_requested_at` set (first
   request kept); otherwise `jobs.not_cancellable` / `jobs.not_found`.
2. `heartbeatJob(ctx, claimed)` → `held` | `cancel_requested` | `lost`; the worker aborts the handler's signal with a
   `JobCancelledError` (name `AbortError`, code `jobs.cancelled`) on `cancel_requested`. `isJobCancelled(signal)`.
3. A progress write that sees the request aborts the same way (the in-process runner's only check).
4. `runClaimedJob`: aborted by a cancel → completion `cancelled` (run row outcome `cancelled`, code
   `jobs.cancelled`, no `onJobFailed`, schedule state untouched). A retry completion of a job with a pending request
   ends `cancelled` instead of `pending`.
5. Claim: a running job with a request whose lease ended is `cancelled`, never re-claimed or failed;
   `releaseJob` of a requested job cancels it.
6. `JobOutcome` and `RunDueJobsReport` gain `cancelled`; `JOB_RUN_OUTCOMES` gains `cancelled`.

## Phase 3: admin page and docs

Files: `src/next/{actions,panel-rows,pages}.tsx`, `src/messages/en.ts`, `tests/panel-rows.test.ts`,
`tests/steering.test.ts`, `README.md`, `CHANGELOG.md`.

1. The page lists running jobs with the problems; a running row shows its progress and "Cancel requested" when set;
   Cancel on pending and running (not yet requested) jobs; `cancelJobAction` calls `requestJobCancel`.
2. README §3 handler context, steering table, §4 page, §5 columns; CHANGELOG `## Unreleased` with the migration.

## Decisions (auto)

- The abort reason is a `JobCancelledError` (an `Error` named `AbortError` with `code: "jobs.cancelled"`) instead of
  a bare string: `fetch` and other libraries reject with the reason, and an `Error` keeps stacks and `instanceof`.
- A handler that returns after the cancel request was seen ends `cancelled` whatever it returned (the issue's rule).
  A job that finishes before its worker sees the request keeps its own outcome, except that a retry becomes
  `cancelled`.
- Throttled reports are not flushed by a timer: the newest one is written by the next report after the window. The
  run summary is the final word on what a run did.
- `RunDueJobsReport` gains `cancelled` (a new required field): honest counts over hiding cancels under `stale`.
- No version bump: the coordinator releases.

## Progress

- [x] Phase 1: `6c6dadd` (progress, migration 0007; tests in `tests/progress-cancel.test.ts`)
- [x] Phase 2: `6c6dadd` (requestJobCancel, heartbeatJob, cancelled outcome; worker test on a real clock)
- [x] Phase 3: `6c6dadd` (page, actions, copy), `09fc99e` (README, CHANGELOG)
