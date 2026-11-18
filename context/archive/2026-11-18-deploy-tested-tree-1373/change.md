---
change_id: deploy-tested-tree-1373
title: "deploy: deploy-tested-tree.yml, so a release skips a unit suite its pull request already passed (issue #1373)"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: 1373
branch: claude/project-thread-dqx9ah
created: 2026-11-18
updated: 2026-11-18
---

## Intent

A release caller learns whether the tag's code already passed the full suite on its pull request, and passes
`unit: false` to `deploy-release-checks.yml` only then.

## Context

Issue #1373. An adopting app's ci-usage report: ~160 runner minutes a week re-running the unit suite on tags that
differ from the tested pull request commit only under `context/`.

## Scope

- New reusable workflow `.github/workflows/deploy-tested-tree.yml` (job `tested`, outputs `tested`, `tested-sha`).
- Behaviour tests in a real git repository with a fake `gh` (`tests/repo/deploy-tested-tree.test.ts`); the runner
  and gh-step invariants list the new job.
- README "Release checks", CHANGELOG, `@softure-ai/deploy` 0.7.4.

## Constraints

- Any doubt answers `tested=false`; `deploy-release-checks.yml` keeps `contents: read` only.
- bash 3.2 and BSD tools (no `tac`).

## Notes

- Research skipped: the inputs are `deploy-release-checks.yml` and the repository tests that guard reusable workflows.
