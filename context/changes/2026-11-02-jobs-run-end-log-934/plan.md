---
change_id: jobs-run-end-log-934
status: in_progress
---

# Plan: log the end of a run (issue #934)

Input: change.md, research.md. Complexity: small (one option, two log sites, tests, docs).

## Phase 1: run-end lines and `logRuns`

Files: `modules/jobs/src/options.ts`, `modules/jobs/src/server/process.ts`, `modules/jobs/src/server/claim.ts`,
`modules/jobs/src/server/run-log.ts` (new), `modules/jobs/tests/process.test.ts`, `modules/jobs/tests/options.test.ts`
(if it pins the parsed defaults), `modules/jobs/README.md`, `modules/jobs/CHANGELOG.md`.

1. `logRuns: z.enum(["all", "failures", "none"]).default("all")` in `jobsOptionsSchema`, exported type
   `JobsRunLogLevel`.
2. `run-log.ts`: `logRunEnd(logger, logRuns, line)` with a discriminated union `succeeded | retried | failed`; the
   success line is skipped unless `all`, every line unless not `none`. Fields as in change.md.
3. `runClaimedJob`: take the start time from `ctx.clock`, pass the job and start to `record()`, log after a recorded
   write; nothing for `stale`.
4. `claimJobs`: one `job run failed` line per job failed with `jobs.lease_expired`.
5. Tests: the three lines with exact fields (succeeded with summary code/items and `durationMs`, retried with
   `runAt`, failed by attempts used up and by `failJob`), no line for a stale write, `failures` drops the success
   line, `none` drops all, the lease-expiry line; adjust the two exact-line tests.
6. README: options table row, §10 Hooks line list; CHANGELOG `Unreleased`.

## Progress

- [ ] Phase 1: run-end lines and `logRuns`
