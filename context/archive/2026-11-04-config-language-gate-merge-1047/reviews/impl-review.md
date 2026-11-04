---
change_id: config-language-gate-merge-1047
verdict: approved
---

# Implementation review

Reviewed the diff of 2ae6958 and e2db1f4 against plan.md.

- Phase 1: `readGitMergeParentLines` reads `MERGE_HEAD` through `git rev-parse --git-path` (works in a worktree and
  for an octopus merge), lists `HEAD` and every merge head, and returns `null` without a merge. A parent without the
  file adds no lines; a failing `git show` returns `null`, so the file is checked in full. The filter runs only in
  file mode and only when there are hits, so a clean commit costs no git call.
- Tests: fake reader (dropped hit, new hit kept, unknown parents and no merge = full check, `--all` unaffected) and a
  real repository with a conflicted merge, where the main branch's Polish line passes and the line typed during
  resolution fails.
- Phase 2: README language gate section and CHANGELOG `## Unreleased` with the migration (nothing to do).
- Gates: typecheck, ESLint on the touched files, `vitest run tools/config tests/repo` green (deploy-workflows after
  installing `ssh-keygen` in the container).

Verdict: approved, no changes.
