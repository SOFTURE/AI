---
change_id: jobs-run-end-log-934
reviewed: 2026-11-02
verdict: approved
---

# Implementation review: jobs-run-end-log-934

Reviewed commit 08e2348 against plan.md and issue #934.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Minor | An invalid payload now logs two lines (the schema warning with paths, then `job run failed` with `jobs.invalid_payload`). | Kept: the first explains why, the second is the attempt's outcome every reader filters on; `process.test.ts` pins both. |
| 2 | Minor | A throwing `onJobFailed` hook logs before the run line, since the hook runs inside `completeJob`. | Kept: order is stable and pinned in `hooks.test.ts`; both lines carry `queue` and `jobId`. |

- `runClaimedJob` logs after `completeJob` returns true, so a refused (stale) write and an aborted handler leave no
  line; a test drives a takeover mid-handler and asserts none.
- Fields match the issue: success with `origin`, `durationMs` (module clock) and the summary's `code`/`items` when
  present; retry with `code` and `runAt` (ISO); failure with `code`. No payload, no error text (a test checks the
  payload value never appears).
- `claimJobs` logs `job run failed` with `jobs.lease_expired` for exhausted leases (change.md Decisions).
- `logRuns` (`all` default, `failures`, `none`) in the schema, exported as `JOBS_RUN_LOG_LEVELS`/`JobsRunLogLevel`;
  an unknown value is refused at startup.
- README (options table, §10 table of lines) and CHANGELOG `Unreleased` with the migration note. No version bump.
- Gates: typecheck, ESLint, language gate green; jobs tests 246/246; the dependent modules' job tests green.

Verdict: approved.
