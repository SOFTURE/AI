---
change_id: config-since-1371
title: "config: --since <rev> for the push-scope bins, so CI can use them (issue #1371)"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: 1371
branch: claude/project-thread-dqx9ah
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Let a CI job on a pull request push ask the same two questions as the pre-push hook (only `context/` changed? only the
main branch merged in?), so an adopting app stops re-running its whole suite for such pushes.

## Context

Issue #1371. `softure-context-only-push` and `softure-merge-push-scope` (config 0.1.6) read the range from `@{push}`,
which a CI checkout does not have. An adopting app's ci-usage report: ~20 % of its pull request runs are context-only
pushes, ~17 % merges of the main branch.

## Scope

- `--since <rev>` / `--since=<rev>` on both bins; `softure-merge-push-scope` reads `origin`'s main branch with it.
- Tests in a real git repository (detached head, unknown commit, code after the tested commit, incoming lockfile).
- README "In CI", CHANGELOG, version 0.1.7.

## Constraints

- Without `--since` nothing changes; an unknown commit or a git error never skips a gate.

## Notes

- Research skipped: the two command files and their tests are the whole input.
