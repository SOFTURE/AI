---
change_id: config-language-gate-merge-1047
title: "config: the language gate checks only the lines a merge commit brings in itself (issue #1047)"
status: open
roadmap_item: null
issue: 1047
branch: claude/project-thread-1oojpe
created: 2026-11-04
updated: 2026-11-04
---

## Intent

Close [issue #1047](https://github.com/SOFTURE/AI/issues/1047): during a merge (`MERGE_HEAD` present) the
`softure-check-language <file>...` run of the pre-commit hook also checks lines that came unchanged from the merged
branch or from the branch itself, so Polish text that is already on the main branch refuses every merge of it.
During a merge, a hit counts only when its line is in neither parent's version of the file.

## Context

Labels: none yet (gap of `@softure-ai/config`, found in an adopting app). The bin is used by this repository's own
pre-commit hook (`tools/config/src/cli/check-language.ts`) and by the lefthook preset for apps. No version bump: the
coordinator releases the batch.

## Constraints

- `--all` and `--commit-msg` keep their behaviour; outside a merge, nothing changes.
- A git error during the merge lookup never weakens the gate: the file is checked in full.
- New Polish lines written while resolving a conflict still fail the gate.
- No change to an app's repository; migration notes in CHANGELOG and README.

## Notes

- Framing: skipped. The issue names the problem, a reproduction and the expected behaviour.
