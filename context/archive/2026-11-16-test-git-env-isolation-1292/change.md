---
change_id: test-git-env-isolation-1292
title: "tests: git in temporary repositories never inherits the hook's GIT_* variables (issue #1292)"
status: archived
archived_at: 2026-11-16
roadmap_item: null
issue: 1292
branch: claude/project-thread-y7m1be
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [issue #1292](https://github.com/SOFTURE/AI/issues/1292): a test that runs `git` in a temporary repository
must act on that repository even when the suite runs from a `pre-push` hook of a git worktree, where git exports
`GIT_DIR` and related variables. Today those calls commit, tag and set `core.bare` in the real repository.

## Context

Labels: `bug`. Seen 2026-11-16 when a push from a worktree ran `tests/repo/deploy-workflows.test.ts` (commit guard,
smoke tag check) through `npm run test:changed`. Many more tests spawn git in temp repositories (`tools/config`,
`tools/deploy`) or run workflow shell steps that call git, so a per-call fix would leave gaps.

## Scope

- One helper that removes git's repository-local variables (the list `git rev-parse --local-env-vars` prints).
- `vitest.config.mts` applies it to `process.env` in the main process, before any worker starts, so every test and
  every child process (git, bash steps, CLIs) inherits a clean environment.
- Tests: the helper's list and behaviour, a temp-repo commit with `GIT_DIR` pointing at a decoy repository leaves the
  decoy untouched, and the test environment check asserts no such variable reaches a worker.

## Constraints

- Author and committer identity variables (`GIT_AUTHOR_*`, `GIT_COMMITTER_*`) stay: they do not locate a repository.
- `vitest --changed` still finds the repository from the working directory (a worktree's `.git` file works).

## Notes

- Framing: skipped. The issue names the cause, the reproduction and the fix.

## Done

- `vitest.config.mts` removes git's repository-local variables (`tests/git-env.ts`, the list of
  `git rev-parse --local-env-vars`) from `process.env` before any worker starts; every test and child process runs
  git against its own working directory. Proof in `tests/repo/git-env.test.ts` and `tests/repo/test-environment.test.ts`.
  No package changed: nothing to release.
