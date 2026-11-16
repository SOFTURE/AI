# Plan review: jobs-scheduled-tick

Verdict: approve with two fixes applied.

1. Warning, contract: the tick's database handle on Workers must come from the request scope; `runJobsTick` takes an
   optional `db` and otherwise resolves `getConfiguredDatabase(config.database)` from `@softure-ai/db/request`, which
   returns the scoped handle. Applied: stated in Phase 1.
2. Warning, test gap: overlapping ticks must not double-run a job; covered by a test with two ticks started at once on
   one database. Applied: listed in Phase 1 tests.
3. Suggestion: `runDueJobs` stays as is (tests and cron apps on Node); no change.
