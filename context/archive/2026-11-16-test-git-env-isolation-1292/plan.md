---
change_id: test-git-env-isolation-1292
status: archived
---

# Plan: git isolation in tests (issue #1292)

Input: change.md, research.md. Complexity: small (test infrastructure only, no package code).

## Phase 1: helper, config, tests (TDD)

Files: `tests/git-env.ts`, `vitest.config.mts`, `tests/repo/git-env.test.ts`, `tests/repo/test-environment.test.ts`.

- `tests/git-env.ts`: `REPOSITORY_GIT_VARIABLES` (git's local list) and `removeRepositoryGitVariables(env)`, which
  deletes them from the given environment object.
- `vitest.config.mts`: call it on `process.env` beside the `TZ` / `NODE_ENV` pins, with the reason.
- `tests/repo/git-env.test.ts`: the list contains every variable `git rev-parse --local-env-vars` of the installed git prints; identity
  variables survive; with `GIT_DIR` set to a decoy repository, a temp-repo `init` + `commit` + `tag` through the
  cleaned environment lands in the temp repo and leaves the decoy's HEAD, tags and `core.bare` unchanged; the same
  calls without cleaning land in the decoy (the hazard the helper prevents).
- `tests/repo/test-environment.test.ts`: no repository-local git variable reaches a worker.
- Verify by hand once: run the deploy-workflows tests with `GIT_DIR` exported to a decoy repository.

## Decisions (auto)

- Clean once in the config instead of per call: it also covers the bash workflow steps and package tests that call
  git, which a helper used at each `spawnSync("git")` would miss. The existing call sites need no change.
- The list is git's own `--local-env-vars`, pinned in code (no spawn in the config) and checked against git by a test.

## Progress

- [x] Phase 1: helper, config, tests (8f09d61)
- [x] Implementation review
