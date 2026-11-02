---
change_id: jobs-run-end-log-934
title: "jobs: log one line when a run ends (succeeded, retried, failed) (issue #934)"
status: in_progress
roadmap_item: null
issue: 934
branch: claude/project-thread-1rw43n
created: 2026-11-02
updated: 2026-11-02
---

## Intent

Close [issue #934](https://github.com/SOFTURE/AI/issues/934): the worker logs nothing when an attempt ends, so a
handler that returns a failure code, a retry or a success is visible only in `jobs.runs` and the admin page. Log one
line per recorded attempt, codes and ids only:

- succeeded: `info("job run succeeded", { queue, jobId, attempt, origin, durationMs, code?, items? })`;
- retried: `warn("job run failed; retrying", { queue, jobId, attempt, code, runAt })`;
- failed: `error("job run failed", { queue, jobId, attempt, code })`.

A new option `logRuns: "all" | "failures" | "none"` (default `"all"`) quiets very frequent queues.

## Context

- Labels: `bug`, `pkg: jobs`, `adoption`. Found in an adopting app's shipped logs.
- #933 changes jobs in parallel: merge a fresh master in before the merge.

## Constraints

- No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- No payload and no error text in a line (the codes are already sanitised `last_error` values).

## Notes

- Framing: skipped. The issue names the lines, their fields, the option and the test.

## Decisions (auto)

- A job failed by an expired lease with no attempts left (`claimJobs`) is a recorded attempt too: it gets the same
  `job run failed` line with `jobs.lease_expired`, so no terminal failure is silent.
- `runAt` is logged as an ISO string, so every logger (console or OpenTelemetry) prints the same value.
- `durationMs` is measured with the module clock from the start of `runClaimedJob` to the recorded write.
- `items` is logged as the summary's object (`{ new, skipped, failed }`), next to `code`, only when present.
