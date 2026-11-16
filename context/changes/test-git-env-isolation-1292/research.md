---
change_id: test-git-env-isolation-1292
---

# Research

- Git exports `GIT_DIR` (and, in a linked worktree, `GIT_COMMON_DIR`-style state through `GIT_DIR`) to hooks. A child
  `git init` / `commit` / `tag` with `cwd` in a temp directory then acts on `$GIT_DIR`, not on the temp directory.
- `git rev-parse --local-env-vars` (git 2.43) prints the variables git itself clears before entering another
  repository (submodules): `GIT_ALTERNATE_OBJECT_DIRECTORIES GIT_CONFIG GIT_CONFIG_PARAMETERS GIT_CONFIG_COUNT
  GIT_OBJECT_DIRECTORY GIT_DIR GIT_WORK_TREE GIT_IMPLICIT_WORK_TREE GIT_GRAFT_FILE GIT_INDEX_FILE
  GIT_NO_REPLACE_OBJECTS GIT_REPLACE_REF_BASE GIT_PREFIX GIT_SHALLOW_FILE GIT_COMMON_DIR`. It is a superset of the
  issue's list.
- Git spawned from tests: `tests/repo/deploy-workflows.test.ts`, `tests/repo/repo-files.ts`,
  `tools/config/tests/*` (merge-push scope, presets, context-only push, check-language), `tools/deploy/tests/*`
  (release guards, integration CLI, cli), `tools/deploy/src/notes/git.test.ts`, plus workflow steps run through bash.
- `vitest.config.mts` already pins `TZ` and `NODE_ENV` on `process.env` in the main process; workers inherit it
  (`tests/repo/test-environment.test.ts` proves it for those two). The same place covers every pool and every child.
