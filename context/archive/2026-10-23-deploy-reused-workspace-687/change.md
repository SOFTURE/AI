---
change_id: deploy-reused-workspace-687
title: "deploy: reusable workflow jobs start from an empty workspace on a reused runner (issue #687)"
status: archived
archived_at: 2026-10-23
roadmap_item: null
issue: 687
branch: claude/project-thread-wuolmx
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #687](https://github.com/SOFTURE/AI/issues/687): on a self-hosted runner that keeps one work directory
per repository between jobs, `deploy-release-checks.yml`'s `static` and `unit` jobs check out the commit after
`prepare`'s sparse checkout (`/package.json` only) and get just `package.json`: `actions/setup-node` then fails with
"Dependencies lock file is not found". `deploy-app.yml` chains sparse and full checkouts in one directory too. Every
job of the reusable workflows that checks out must get the commit it asked for, whatever an earlier job left in the
work directory.

## Context

Labels: `bug`, `pkg: deploy`. Touches the reusable workflows under `.github/workflows/` (`deploy-*.yml`,
`blog-links.yml`), `tests/repo/workflow-runners.test.ts`, `tools/deploy/README.md` ("Runner") and
`tools/deploy/CHANGELOG.md`. Runs alongside #684 and #686, which touch the same workflows: fresh master is merged in
before the merge. No release in this change: the coordinator releases in the next batch.

## Constraints

- Hosted runners behave as before (their workspace is empty already).
- Shell stays bash 3.2 and BSD/GNU neutral.
- A workspace that cannot be emptied fails the job with an error that says why, never silently.

## Out of scope

- The app's own jobs that share the runner's work directory: the README names the runner-side fix.
- The GitHub CLI on a self-hosted runner (#686).

## Notes

- Framing: skipped. The issue names the defect and the options.
