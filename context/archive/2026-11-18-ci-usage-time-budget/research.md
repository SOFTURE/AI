# Research: ci-usage-time-budget

## Evidence

- Run 44346286208 (`ci-usage-self.yml`, dispatch, 0.1.0): the Report step started 16:21:37 and was cancelled at
  16:36:47 by `timeout-minutes: 15`; the log has no output from the CLI, the cache restore found nothing.
- SOFTURE/AI: about 1,150 workflow runs a week (research of ci-usage-report), so about 1,150 job requests plus a
  dozen run-list requests on a cold cache.
- `tools/ci-usage/src/collect.ts`: `collectRepository` awaits `listJobs` for each run in turn, oldest first; a budget
  result stops the loop and records "stopped at the rate limit: N of M runs not counted".
- `.github/workflows/ci-usage.yml`: one job, 15-minute timeout, `actions/cache` saves the run cache only when the job
  ends without being cancelled.

## Options

1. Raise the timeout: the report itself then costs 20+ minutes a cold week, and a busier app still hits it.
2. Concurrent job reads: GitHub allows parallel REST reads (secondary limit at 100 concurrent requests); 8 at a time
   cuts the cold read to a few minutes.
3. A time budget in the CLI: whatever the speed, past it the collector stops reading and reports partial; the cache
   keeps the counted runs, so a daily run converges.

Decision: 2 and 3 together. The workflow passes a budget of 10 minutes, below its 15-minute timeout.

## Risks

- Concurrency must keep the counted set a clean oldest-first prefix, so the partial note stays true.
- The time budget is checked between batches; one batch takes seconds, so the overshoot is small.
