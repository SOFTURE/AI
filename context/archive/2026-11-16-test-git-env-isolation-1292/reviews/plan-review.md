---
change_id: test-git-env-isolation-1292
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (d157a76).

- Ask 1 (every git call in repository tests runs without `GIT_*`): the config-level clean covers every spawn, direct
  or through bash, in every pool; workers inherit `process.env` (as the existing `TZ` pin shows).
- Ask 2 (a test with `GIT_DIR` set proves the real repository untouched): `git-env.test.ts` with a decoy repository,
  plus a control that shows the hazard without the clean.
- Risk: `vitest --changed` in a worktree loses `GIT_DIR`; git discovers the worktree from the working directory, so
  it still works. Checked by the manual run against a worktree's `GIT_DIR`.
- Risk: the pinned list drifts from a newer git; the test asserts that the installed git's list is contained in ours.

Verdict: approved, no changes.
