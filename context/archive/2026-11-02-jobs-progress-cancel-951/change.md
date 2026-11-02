---
change_id: jobs-progress-cancel-951
title: "jobs: progress reported by a running handler, and cancelling a running job (issue #951)"
status: archived
roadmap_item: null
issue: 951
branch: claude/project-thread-r7umfc
created: 2026-11-02
updated: 2026-11-02
archived_at: 2026-11-02
---

## Intent

Close [issue #951](https://github.com/SOFTURE/AI/issues/951). A long job cannot say how far it got (`getJob` shows
`running` until the end), and a running job cannot be stopped (`cancelJob` answers `jobs.not_cancellable`). Take the
issue's proposal: `context.reportProgress({ step, done?, total?, code? })` stores a code-only progress on the job,
`getJob` / `listRecentJobs` return it, `requestJobCancel(ctx, id)` cancels a pending job or asks a running one to stop
(its handler's `signal` aborts, the job ends `cancelled`, not retried), and the admin page shows progress and a Cancel
button for running jobs.

## Context

Labels: `enhancement`, `pkg: jobs`, `status: in progress`. Issues #952 and #958 wait for this change. Open pull
requests on `jobs` in parallel: #941, #943, #946, and #955 is being worked on (it likely adds a migration too); fresh
master is merged in before the merge and a migration number clash is renumbered then. No release in this change: the
coordinator releases.

## Constraints

- `cancelJob` keeps its meaning (pending only).
- Progress follows the run summary's rules: codes and counts only, checked before it is written; an invalid one is
  dropped with a warning, never failing the job.
- Every write of a claimed job stays fenced by the claim token.
- Migrations move forward only and say how to roll back.

## Notes

- Framing: skipped. The issue names the problem and a concrete proposal.
