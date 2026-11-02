---
change_id: jobs-progress-cancel-951
verdict: approved
---

# Implementation review

Reviewed the diff of 6c6dadd and 09fc99e against plan.md and issue #951.

- Proposal 1 (`reportProgress`): checked with `jobProgressSchema`, code-only, throttled to one write per second per
  attempt with the newest held report written when the window ends or the handler returns, fenced by `isHeld`. A
  failed write is a warning; the handler never sees a throw. Tests: stored and read back, throttle, invalid input,
  reset per attempt, a stale claim.
- Proposal 2: `Job` carries `progress`, `progressAt`, `cancelRequestedAt`; a stored progress is checked again on read.
- Proposal 3: `requestJobCancel` covers pending (cancelled at once), running (request, first time kept), finished and
  unknown ids. The worker's heartbeat and a progress write abort with `JobCancelledError`; the runner records
  `cancelled` whatever the handler returned and logs no thrown cancel. Lease end, release on shutdown and a retry
  after a request all end `cancelled`; a success or failure before the request was seen keeps its outcome and drops
  the request (the table check would refuse a finished row with a request otherwise). `retryJob` clears both.
- Proposal 4: the page lists running jobs with progress lines, a requested cancel, and Cancel until requested; the
  action uses `requestJobCancel`. Covered in panel-rows and next tests, plus a worker test on a real clock.
- Migration 0007 is additive with a written rollback; the runs outcome check is replaced, not loosened.
- Gates: typecheck and lint green (pre-commit), jobs suite 255 tests and repo tests green.
- Language: English only; no copy inline outside `messages/en.ts`.

Follow-ups: none. Verdict: approved.
