---
change_id: jobs-queue-pacing-breaker-955
reviewed: 2026-11-02
verdict: approved
---

# Implementation review: jobs-queue-pacing-breaker-955

Reviewed the change against plan.md and issue #955.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Major | Adding `paused` to `RunDueJobsReport` breaks every test (in this repository and in apps) that compares the whole report with `toEqual`. | Fixed: `runDueJobs` counts a `pauseQueueLater` attempt as `retried`, the same outcome its run row has; the report's shape is unchanged. |
| 2 | Minor | An unpaced queue now reads its `queue_state` row on every claim. | Accepted: one indexed primary-key read per queue per poll, no lock. |
| 3 | Minor | `completeJob` now resolves the queue's options; a job of a queue removed from the config throws there. | Accepted: `claimJobs` already refuses such a queue, so no held job can reach it. |
| 4 | Minor | A job given its attempt back by `pauseQueueLater` repeats its attempt number in the run history. | Accepted and documented: the row is `retried` with the code, which says what happened. |

- Acceptance, issue asks: (1) `rateLimit` both shapes, enforced in the claim under a row lock, shared by workers
  (tests: gap across two worker ids, jitter, window); (2) `breaker` trip, doubling, cap, reset on success, `codes`,
  failures while paused only count; (3) `pauseQueueLater` pauses at once, gives the attempt back, never shortens a
  pause; (4) `pauseQueue` / `resumeQueue`, `getQueueStats.pause` and `consecutiveFailures`, panel lines and
  Pause / Resume (actions, panel and rows tests); (5) `onQueuePaused`, a throwing hook logged; (6) paused and paced
  jobs keep their attempts (asserted after each hold).
- README §1, §3 "Pacing and the circuit breaker", steering table, §4, §5, §9, §10, §12; CHANGELOG `Unreleased` with
  the migration. Migration `0007_create_queue_state.sql` with its rollback; manifest and `module.json` list the table.
- Gates: typecheck, ESLint, language gate green; jobs tests 258/258.

Verdict: approved.
