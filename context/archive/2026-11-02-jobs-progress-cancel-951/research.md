# Research: jobs progress and cancel (issue #951)

Read on master c9380e5: `modules/jobs/src/server/{claim,process,admin,run-due}.ts`, `src/worker/run-job-worker.ts`,
`src/handlers.ts`, `src/summary.ts`, `src/next/{actions,panel-rows,pages}.tsx`, `migrations/0001`, `0006`, README §3–§5.

## Findings

- Every write after the claim is fenced by `isHeld` (id, `running`, claim token). A progress write fits the same
  pattern: one `UPDATE … WHERE isHeld RETURNING`.
- The worker's heartbeat (`extendJobLease`, a third of the lease) is the natural place to see a cancel request: the
  same fenced `UPDATE` can return `cancel_requested_at`. `extendJobLease` is public and returns a boolean, so a new
  `heartbeatJob` returns the richer state and `extendJobLease` stays as is.
- `runClaimedJob` returns `stale` whenever the signal is aborted. A cancel abort must instead record `cancelled`, so
  the abort needs a reason the runner can recognize.
- `runDueJobs` passes a signal that never aborts; for the in-process path the progress write can also see the request
  and abort the handler, so tests (and cron-driven apps) get cancellation without a heartbeat.
- Table checks: lease columns set exactly while `running`, `finished_at` exactly for finished states. A new
  `cancel_requested_at` fits with `status IN ('running', 'cancelled')`.
- A running job whose lease ends is re-claimed (or failed with `jobs.lease_expired` when out of attempts). With a
  cancel request it must become `cancelled` instead; a release on shutdown likewise.
- `jobs.runs.outcome` allows `succeeded`, `retried`, `failed` (inline check, auto-named `runs_outcome_check`). A
  cancelled attempt is a run too, so `cancelled` joins the outcomes; `error_code` is then `jobs.cancelled`, which
  keeps the `(outcome = 'succeeded') = (error_code IS NULL)` check.
- The admin page lists only `failed`, `cancelled`, `retrying` jobs; running jobs must be added for the Cancel button.
- Parallel PRs: #943 touches `process.ts` and `claim.ts` (run-end log), #941 `run-job-worker.ts`, #946 `sync-items.ts`.
  Conflicts expected in those files and in the CHANGELOG; resolved when master is merged in.
