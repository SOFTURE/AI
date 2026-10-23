---
change_id: deploy-runs-on-670
title: "deploy: a runs-on input on every reusable workflow (issue #670)"
status: in_progress
roadmap_item: null
issue: 670
branch: claude/project-thread-957xfo
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #670](https://github.com/SOFTURE/AI/issues/670): every job of the reusable workflows hard-codes
`runs-on: ubuntu-latest`, so a caller cannot move its CI/CD to a self-hosted runner. Add one `runs-on` input per
workflow (a JSON string, default `'"ubuntu-latest"'`) that every job reads with `fromJSON`, check its shape, document
what a self-hosted runner must provide, and guard against a hard-coded runner in `tests/repo/`.

## Context

Labels: `enhancement`, `pkg: deploy`. Workflows: `deploy-app`, `deploy-release-checks`, `deploy-integration`,
`deploy-release-image`, `deploy-report`, `deploy-cut-release`, `deploy-release-notes`, `deploy-cancel-run`,
`blog-links`. No release in this change: the coordinator releases deploy in the next combined release.

## Constraints

- Additive: the default keeps every existing caller on `ubuntu-latest`.
- One input per workflow; no per-job runners (out of scope in the issue).
- The composite action `.github/actions/deploy` runs on the caller's job and is not touched.
- Nothing interpolated into a script: the value reaches the check through `env:`.

## Notes

- Framing: skipped. The issue names the problem, the proposal and the scope.
