---
change_id: deploy-release-report
title: "The release body carries pipeline status and deployment history"
status: archived
roadmap_item: DF-10
branch: claude/project-thread-drvkzo
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

After every run of the reusable deploy workflow, the GitHub Release of the deployed tag shows how the run went: a
pipeline status table (each job's result and a link to the run) that the latest run replaces, and a deployment
history with one row per run (time, result, image and digest, backup file, row counts before and after, verify
result), newest first. A rerun or a rollback adds a row and never replaces an earlier one. The owner's text in the
release body and the `release-notes` section (DF-1) stay as they are.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-10**:

> - **Outcome:** a final report job of `deploy-app.yml` writes, with `release-notes --body` (DF-1), a pipeline status
>   table (each job's result and the run link) and a deployment history row per run (time, result, image and digest,
>   backup file, row counts before and after, verify result) into the GitHub Release body, newest first; reruns and
>   rollbacks add rows, never replace them.
> - **Prerequisites:** DF-9 on `master`.
> - **Unknowns:** whether the history lives in the release body or in a deployment record (GitHub Deployments API).
> - **Risk:** low. A report; the release itself does not depend on it.
> - **Source:** DF-1 (`deploy-fire-parity`), research: FIRE's `src/lib/release-notes.ts` (status, deployments) and
>   the `report` job of `release.yml` (research §2).

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). The section mechanism of the release body
came from DF-1 ([archive](../../archive/2026-10-06-deploy-fire-parity/change.md)); the server's `step|…` and
`result|…` lines come from DF-9 (`deploy-server-safety`, PR #132).

## Constraints

- DF-9 changes `deploy.sh.tmpl` and the send step of `deploy-app.yml`; this change starts from its design and takes
  `master` once DF-9 has merged, before it touches those two files.
- The release must not depend on the report: a failed report never turns a deploy red.
- No secret value in the report: only step names, file names, table names and counts.
- No real deploy, tag, publish or release edit from this session. English-only code, comments and commits.
  FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy-followups, item DF-10 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done (`research.md`): FIRE's report job and format, what a reusable workflow can be granted, and what
  DF-9's server lines carry.
- Framing skipped: the roadmap item fixes the problem (a release says nothing about how its deploy went) and the
  shape (FIRE's living report); research answered the one open question (release body, not Deployments API) and
  found one constraint on the shape (the write permission, research §3), which the plan meets without changing what
  is built.
- Archived 2026-10-06: `softure-deploy release-report` writes the run's pipeline status (replaced) and a deployment
  row (newest first, earlier rows kept) into the release body; `deploy-app.yml`'s `summary` job uploads the run's
  facts as `deploy-report`, the new reusable `deploy-report.yml` (the caller's second job, `contents: write` there only)
  edits the release; `init`'s `deploy.sh` puts the backup file and the row counts on its step lines. The e2e runs the
  report on a fixture body. Rides `@softure-ai/deploy` 0.1.3 (unpublished, with DF-7, DF-8 and DF-9). No new gaps.

