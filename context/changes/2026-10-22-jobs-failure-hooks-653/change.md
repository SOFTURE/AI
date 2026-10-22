---
change_id: jobs-failure-hooks-653
title: "jobs: hooks when a job ends failed or a schedule turns failing or late (issue #653)"
status: in_progress
roadmap_item: null
issue: 653
branch: claude/project-thread-wxkrco
created: 2026-10-22
updated: 2026-10-22
---

## Intent

Close [issue #653](https://github.com/SOFTURE/AI/issues/653) (labels `enhancement`, `pkg: jobs`): an app that runs
unattended work has no hook to tell its operator when something breaks; it polls `getQueueStats` and keeps its own
"already alerted" state. Add optional `onJobFailed` and `onScheduleStateChanged` hooks to `jobs({ ... })`, run once
per terminal failure and once per schedule health transition, plus a test helper that records their calls.

## Context

jobs 0.1.4 is the latest release; #651 (calendar filters) is on master under `## Unreleased`. Releases are batched by
the coordinator: no version bump. #654 (also jobs) waits for this merge.

## Constraints

- Events carry codes and ids only: never a payload or an error's text.
- A hook that throws is logged by error kind and never fails the job, the claim or the worker.
- One call per transition however many workers run (state kept in the database, conditional update).
- Forward-only migration with a rollback note; apps without hooks see no behaviour change.

## Acceptance

1. `onJobFailed` runs once when a job ends `failed`: attempts used up, `failJob`, invalid payload, lost lease with
   no attempts left. Not on a retried attempt, not on a stale (fenced) write.
2. `onScheduleStateChanged` runs once per transition between `healthy`, `failing` and `late`, including the
   recovery back to `healthy`; a schedule that keeps failing does not alert again.
3. A throwing hook is logged and the job outcome and worker loop are unaffected.
4. `@softure-ai/jobs/testing` has a helper that collects hook calls for a test using `runDueJobs`.

## Notes

- Framing: skipped. The issue names the gap, the hook shapes and the contract (same as `onReconnectRequired`).

## Decisions (auto)

- One schedule state at a time with precedence `failing` > `late` > `healthy`: a failing schedule usually also
  turns late, and reporting both would alert twice for one problem.
- The last reported state is a new column `jobs.schedules.reported_state` (default `healthy`), moved by a
  conditional `UPDATE ... WHERE reported_state <> $new`, so exactly one worker reports a transition.
- The worker checks schedule states at most once a minute (and `runDueJobs` once at its end): lateness moves with
  the clock, so it needs a periodic check; a minute's delay is fine for an operator alert.
- Hooks run after the write that caused them commits (never inside the transaction), awaited, errors logged through
  the caller's `JobsLogger` (default the console logger). `claimJobs` and `completeJob` gain an optional `logger`.
- Without `onScheduleStateChanged` the check writes nothing (no extra queries for apps that do not use it).
