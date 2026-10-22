---
change_id: jobs-failure-hooks-653
---

# Research: hooks for failed jobs and schedule health (issue #653)

## Where a job ends `failed`

- `server/claim.ts` `completeJob`: the fenced write of an attempt's outcome, `completion.kind === "failed"`. Reached
  from `server/process.ts` `runClaimedJob` for `failJob`, an `Err` with no attempts left, a throw with no attempts
  left, and an invalid payload. Also public: an app may call it directly.
- `server/claim.ts` `failExhaustedLeases` (inside `claimJobs`): running jobs whose lease ended with no attempts left
  become `failed` with `jobs.lease_expired`, in a transaction that also notes the schedule failure.
- Both write in a transaction and know whether the write happened (`returning`), so a hook fired after the commit
  runs exactly once per failure. `runClaimedJob` returns `stale` when the fenced write was refused.

## Schedule health

- `server/schedules.ts` `getScheduleStates` derives `isFailing` (last failure later than last success) and `isLate`
  (no success within two periods/slots) from the `jobs.schedules` row; nothing is stored about what was reported.
- `isLate` changes with the clock alone, so a transition can only be found by checking periodically; the worker loop
  already runs every `pollIntervalMs` and prunes once an hour on a timer.
- A schedule without a row (no worker ever enqueued it) reads as late; there is no row to keep reported state in, so
  it is skipped until a worker sees it.

## Prior art

`modules/connections/src/server/store.ts` `markReconnectRequired`: conditional update, then the hook after the write,
`try`/`catch` with `errorLogLabel`. Options declare the hook with `z.custom<Hook>((value) => typeof value === "function")`.

## Tests

`modules/jobs/tests/support.ts` builds the config from `Partial<JobsOptionsInput>`, so hooks can be passed in. PGlite
runs the migrations, so a new column is covered by every test.
