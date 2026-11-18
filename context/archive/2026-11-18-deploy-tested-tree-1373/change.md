---
change_id: deploy-tested-tree-1373
title: "deploy: a release skips the unit suite its last pull request already passed (issue #1373)"
status: archived
archived_at: 2026-11-18
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

## Done

- `deploy-tested-tree.yml` and its use in the fail-fast example pipeline, in `@softure-ai/deploy` 0.7.4 (released by
  `auto-release.yml` after the merge).

## Decisions (auto)

- Trees compared through the API (`git/trees?recursive=1`) instead of a checkout: works for merge, squash and rebase
  merges and for a deleted head branch, with no credentials; a truncated tree answers `"false"`.
- The last merged pull request is the newest by `merged_at` whose merge commit is an ancestor of the tag (`compare`
  status `ahead` or `identical`), among the 30 most recently updated closed pull requests, at most 10 compared.
- `check-names` take globs, since matrix shards carry their index in the name; skipped runs do not count as passed.
- In the fail-fast example the `unit` call is skipped rather than given `unit: false`, since `deploy-release-checks.yml`
  refuses a call with nothing to run.
- Patch release (0.7.4): no CLI code changed, and a minor would fall outside dependents' `^0.7.0` ranges.
