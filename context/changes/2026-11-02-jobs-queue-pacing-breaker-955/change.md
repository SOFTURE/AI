---
change_id: jobs-queue-pacing-breaker-955
title: "jobs: a rate limit per queue and a circuit breaker that pauses a queue (issue #955)"
status: open
roadmap_item: null
issue: 955
branch: claude/project-thread-vask3f
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #955](https://github.com/SOFTURE/AI/issues/955): a queue that calls a third-party service with an
unwritten request budget needs pacing shared by every worker (a minimum gap with jitter, or at most N claims per
window) and a breaker that pauses the queue after N consecutive refusals, grows the pause when the first run after it
fails again and resets after a success. A handler can pause the queue at once (`pauseQueueLater`), an operator can
pause and resume it (server functions and the admin page), `getQueueStats` shows the pause, and `onQueuePaused`
alerts the app. Jobs held back by a pause or the pacing keep their attempts.

## Context

- Labels: `enhancement`, `pkg: jobs`. Package `modules/jobs` 0.1.6.
- Checked first that no other session shipped it: nothing on master (c9380e5) mentions #955, no branch or pull request
  for it. Open jobs PRs #941, #943, #946 touch the worker loop, run logging, the sync ledger and the CHANGELOG; this
  change touches the claim, the completion and the panel, so CHANGELOG, README and `run-job-worker.ts` may conflict.

## Constraints

- No version bump: the coordinator releases the batch. CHANGELOG under `## Unreleased`.
- One forward-only migration (`0007_create_queue_state.sql`) with its rollback.
- A queue without `rateLimit` or `breaker` keeps today's claim path; its only new cost is one read of the pause row.
- The adopting app is not changed here; the CHANGELOG says what it can drop.

## Notes

- Framing: skipped. The issue names the problem, the shape of every option and the acceptance.
