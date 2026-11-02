# Research: log the end of a run (issue #934)

## Findings

- `modules/jobs/src/server/process.ts`: `runClaimedJob` is the one path for an attempt (worker and `runDueJobs`).
  It logs only a payload mismatch (warn), a throw (error), a non-result (error) and an invalid summary (warn).
  `record()` calls `completeJob` and maps the completion to the `JobOutcome`; a refused (stale) write returns
  `stale`, which is not a recorded attempt and must stay silent.
- `ClaimedJob.job` carries `queue`, `id`, `attempts` (the claim counted this attempt) and `origin`.
- `Completion` (`claim.ts`) holds the checked summary on success, the code and `runAt` on retry, the code on failure.
- `claimJobs` fails exhausted leases (`failExhaustedLeases`) without any line; it has `input.logger` (default
  console) for the hook.
- `JobsLogger` (`logger.ts`) is `info`/`warn`/`error(message, fields)`; the console logger prints `key=value`,
  dates as ISO, objects as JSON. `@softure-ai/observability`'s `Logger` fits it.
- Options are parsed by `jobsOptionsSchema` (`src/options.ts`) and read with `getJobsOptions(ctx.config)`.
- Tests: `tests/process.test.ts` uses a fake logger recording `level: message`; two tests assert the exact lines
  (payload mismatch, throw) and will gain the new end line. `tests/worker.test.ts` asserts exact lines only where no
  job runs.

## Options

1. Log inside `completeJob`: it is exported and used by apps driving claims themselves; logging there changes a
   lower-level function and needs the summary and start time passed in.
2. Log in `runClaimedJob` after `completeJob` returns true, as the issue asks, plus the lease-expiry failures in
   `claimJobs`.

## Recommendation

Option 2.
