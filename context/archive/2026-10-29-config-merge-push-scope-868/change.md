---
change_id: config-merge-push-scope-868
title: "config: a pre-push that only merges the tested main branch runs the related tests, not the full suite (issue #868)"
status: archived
roadmap_item: null
issue: 868
branch: claude/project-thread-bijkkf
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #868](https://github.com/SOFTURE/AI/issues/868): the lefthook preset of `@softure-ai/config` runs the full
`npm test` on `pre-push` even when the push only merges the already-tested main branch into a change branch. Add a
third speed: such a push runs typecheck, ESLint, the language gate and `vitest related` for the files the branch
changes. An incoming migration, dependency, test-setup or config change, new code of the branch, no upstream or a git
error keep the full suite.

## Context

Labels: `enhancement`, `pkg: config`. Context: SOFTURE/SKILLS#15 point 4; point 2 was #641 (`softure-context-only-push`).
#859 and #864 (theme-notion) run in parallel threads. No version bump: the coordinator releases the batch.

## Constraints

- Only the package; no change to an app's repository. Migration steps in CHANGELOG and README.
- No gate gets weaker on uncertainty: anything not provably a merge of the main branch runs the full suite. CI keeps
  the full suite.
- `softure-context-only-push` keeps its behaviour.
- Bash-free: the bin is Node, so macOS and Linux behave the same.

## Notes

- Framing: skipped. The issue names the problem, the measurement and the proposal.
