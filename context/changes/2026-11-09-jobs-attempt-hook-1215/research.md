# Research: jobs per-attempt outcome hook (#1215)

- Every attempt the worker and `runDueJobs` run ends in `runClaimedJob` (`src/server/process.ts`), which decides the
  completion (`decide`) and writes it through `recordCompletion` (`src/server/claim.ts`). `record()` already maps the
  recorded completion to a `JobOutcome` and logs it: the single place where the outcome, the code and the duration
  (`startedAt`) are all known after the write committed.
- `recordCompletion` turns a retry of a cancel-requested job into `cancelled`; reading the outcome after it keeps the
  hook in line with what was stored. A refused write returns null (`stale`): nothing was recorded.
- Hooks live in `src/server/hooks.ts` (`runHook` logs a throw by name and swallows it); options in `src/options.ts`
  (`z.custom` function checks); `recordJobHooks()` in `src/testing` records the other hooks.
- Lease expiry with no attempts left (`failExhaustedLeases`) is not an attempt any process ran; `onJobFailed` already
  reports it with `jobs.lease_expired`.
- Option 2 of the issue (built-in OpenTelemetry instruments) would add a dependency on `@opentelemetry/api` to jobs and
  fix metric names for every app; the hook lets the app use its own meter, names and labels.
