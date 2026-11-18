---
change_id: deploy-tested-tree-1373
title: "deploy: a release skips the unit suite its last pull request already passed (issue #1373)"
status: in_progress
roadmap_item: null
issue: 1373
branch: claude/project-thread-rtrzg4
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Let a release pipeline skip the unit suite when the tag's code is exactly the code the last merged pull request
passed it on, and run it as before on any doubt.

## Context

Issue #1373 (`@softure-ai/deploy`). An adopting app spends about 160 runner minutes a week re-running the unit suite on
a tag whose code passed the same suite on its pull request minutes earlier; the tag differs only in workflow artifacts
under `context/`. `deploy-release-checks.yml` has `unit: false`, but nothing tells the caller when skipping is safe.

## Scope

- A reusable workflow `.github/workflows/deploy-tested-tree.yml`: output `tested` is `"true"` only when the tag's tree
  equals, outside `ignore-prefixes` (default `context/`), the head commit of the last merged pull request whose
  check runs named in `check-names` all succeeded; `"false"` on any doubt.
- The fail-fast example pipeline (`tools/deploy/examples/deploy-pipeline.yml`) and the README use it; tests in
  `tests/repo/`; CHANGELOG; a patch release of `@softure-ai/deploy` with `deploy-cli-version` bumped.

## Constraints

- `deploy-release-checks.yml` keeps `contents: read`: a pull request's caller grants nothing more.
- Any API or git failure answers `"false"`, never a red job; only invalid inputs fail.
- Shell stays within bash 3.2 and BSD/GNU-common tools (macOS test job).

## Notes

- Frame skipped: the issue states the problem, the measurement and the proposal.
