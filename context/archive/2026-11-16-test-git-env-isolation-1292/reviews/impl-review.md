---
change_id: test-git-env-isolation-1292
verdict: approved
---

# Implementation review

Reviewed 8f09d61 against plan.md.

- Phase 1 delivered as planned: `tests/git-env.ts`, the config call beside the `TZ` / `NODE_ENV` pins, the decoy
  repository test with its hazard control, the worker environment check.
- Red first: `GIT_DIR=/nonexistent/.git npx vitest run tests/repo/test-environment.test.ts` failed before the config
  change and passes after it.
- Reproduction against a worktree's `GIT_DIR` (a scratch clone with a linked worktree, `GIT_DIR=<clone>/.git/worktrees/<wt>`):
  - without the config change, `deploy-workflows.test.ts -t "commit guard|smoke"`: 8 failed, and the decoy got commits
    `release`, `on main`, `off main`, tags `v2026.10.12`, `v2026.10.12-2` and `core.bare = true`, exactly as in the issue;
  - with it, `deploy-workflows.test.ts`, `tools/config` and `tools/deploy`: 59 files, 1300 passed, 18 skipped; the
    decoy's HEAD, tags and `core.bare` unchanged.
- Gates: typecheck, ESLint on the changed files, language gate green (pre-commit).
- No package source changed, so no release and no CHANGELOG entry.

Verdict: approved.
