---
change_id: blog-aside-word-length-700
title: "blog: single letters do not make an aside worded (issue #700)"
status: in_progress
roadmap_item: null
issue: 700
branch: claude/project-thread-q8jemt
created: 2026-10-23
updated: 2026-10-23
---

## Intent

Close [issue #700](https://github.com/SOFTURE/AI/issues/700): `countWordedAsides` counts any run that starts with a
letter as a word, so a formula such as `K × (1 + r/m)^(m × n)` reads as two worded asides and `checkCopyText` fails
it with a `stacked-asides` error (a warning in the article gate). A word counts only from two letters up, so math
variables and one-letter words or abbreviations do not make an aside worded.

## Context

Labels: `bug`, `pkg: blog`. Issue #699 touches the same rules file in parallel; the fresh master is merged in before
the merge. No release in this change: the coordinator releases blog in the next combined release.

## Constraints

- The aside counter is shared by the article gate (`style.ts`) and the copy check (`copy.ts`); both change together.
- Real worded asides keep their findings, Polish ones with a one-letter word among longer words included.

## Notes

- Framing: skipped. The issue names the problem and the fix.
