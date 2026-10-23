---
change_id: deploy-gh-self-hosted-686
title: "deploy: the reusable workflows install the GitHub CLI on a runner without it (issue #686)"
status: in_progress
roadmap_item: null
issue: 686
branch: claude/project-thread-80srlx
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #686](https://github.com/SOFTURE/AI/issues/686): on a self-hosted runner (`runs-on`, issue #670) the jobs
that call `gh` stop with `gh: command not found` (exit 127), because only GitHub's hosted images ship the GitHub CLI.
Every job that runs `gh` installs a pinned, checksum-verified copy into `$RUNNER_TEMP` when the runner has none, with
no `sudo` and no change to the runner, and fails with a readable reason when it cannot.

## Context

Labels: `bug`, `pkg: deploy`. Jobs that run `gh`: `deploy-cut-release` → `cut`, `deploy-report` → `report`,
`deploy-release-notes` → `notes`, `deploy-cancel-run` → `cancel`, `deploy-integration` → `record`. No release in this
change: the coordinator releases deploy in the next combined release. An app's own steps that call `gh` are the app's
to change (the README says so).

## Constraints

- No change on GitHub-hosted runners: a runner that has `gh` uses it, the step does nothing.
- Nothing downloaded is run unverified: the archive's SHA-256 is pinned in the workflow.
- bash 3.2 and BSD/GNU-neutral flags (the step runs in the repository tests on macOS too).
- Nothing interpolated into a script.

## Notes

- Framing: skipped. The issue names the problem and both acceptable outcomes; this change takes the first.
