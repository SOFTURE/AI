# Plan: bump-softure-packages-2026-11-27

## Approach
One phase: install `@softure-ai/skills` 0.41.2, run the installer, regenerate `context/state.json`, run the doctor.

## Decisions (auto)
- D1 Change-id follows `routines/package-updates.md` (`bump-softure-packages-<date>`); the branch stays the thread's
  session branch, as the harness requires.
- D2 The installer's hint to add `"project"` to `context/workflow.json` is left out: the issue says to change nothing
  else, and the doctor passes without it.

## Phase 1 (test-after)
- Files: `package.json`, `package-lock.json`, and whatever the installer and `npx softure-skills state` rewrite.
- Done when: the installed, locked and newest npm versions are 0.41.2, the doctor exits 0, and typecheck, lint,
  the related tests and build pass.

## Progress
- [ ] Phase 1
