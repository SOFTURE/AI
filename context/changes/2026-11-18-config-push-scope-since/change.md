---
change_id: config-push-scope-since
title: "config: --since for softure-context-only-push and softure-merge-push-scope (issue #1371)"
status: open
roadmap_item: null
issue: 1371
branch: claude/project-thread-4mpdh1
created: 2026-11-18
updated: 2026-11-18
---

## Intent

A CI job can ask both bins the same question the pre-push hook asks, for a range it names: `--since <rev>` compares
`<rev>` with `HEAD` instead of `@{push}..HEAD`. An adopting app then skips the heavy pull request jobs for a push that
changes only `context/` or only merges the main branch in, the two cases the hook already skips locally.

## Context

- Labels: `enhancement`, `pkg: config`. Version on npm: `@softure-ai/config@0.1.6`.
- `@{push}` exists only in a local clone with an upstream; a CI checkout is detached, so today both bins answer
  "run everything" there.

## Constraints

- No change in behaviour without `--since`.
- An unknown or all-zeros `<rev>` never skips anything: `context-only-push` answers 1, `merge-push-scope` answers `full`.
- Under `--since` the main branch is read on `origin` (a CI checkout's remote).

## Notes

- Frame skipped: the issue measures the gap and names the fix; the bins already hold the logic, only the range source
  changes.

## Done
