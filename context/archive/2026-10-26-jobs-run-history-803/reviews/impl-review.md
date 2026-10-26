---
change_id: jobs-run-history-803
verdict: approved
---

# Implementation review

Reviewed the diff from 2a8caf2 against plan.md, plan-review.md and issue #803.

- Asks covered: summary via `ok({ summary })` (checked by `jobRunSummarySchema`), `origin` on `enqueueJob` and
  `runScheduleNow` (schedule tick `schedule`), `jobs.runs` with `retention.runsDays` (30) and `pruneJobRuns`,
  `listJobRuns`, and a Recent runs section on the admin page.
- Fencing: the run row is inserted inside `completeJob`'s transaction after the fenced update, so a stale claim writes
  nothing (tested). The lease-expiry path writes its rows in the same transaction as the failure.
- Privacy: no payload is copied; the invalid-summary warning carries paths only (tested with a value that must not
  leak); panel rows are built field by field (tested).
- Compatibility: migration defaults `origin` to `app`; `runs` is optional on `JobsPanel`, `JobsPanelSource` and
  `JobsPanelData`; `Completion.summary` is optional. `Job` gains `origin` (additive for readers; one test that
  compared a whole `Job` was updated). The CHANGELOG names the step for an app with its own full dictionary.
- Start time: `ClaimedJob.job.updatedAt` is the claim's `now` (commented in `toRunRecord`); the lease extension does
  not touch the in-memory job.
- Not tested directly: the worker's hourly `pruneJobRuns` call, which mirrors the existing untested `pruneJobs` and
  `pruneSyncItems` calls next to it; `pruneJobRuns` itself is tested.
- Gates: typecheck, lint (ESLint + language), `vitest run modules/jobs` 232 passed.

Verdict: approved.
