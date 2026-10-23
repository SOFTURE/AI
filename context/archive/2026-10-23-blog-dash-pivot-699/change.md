---
change_id: blog-dash-pivot-699
title: "blog: dash-pivot catches a dash next to one number and a glued em dash (issue #699)"
status: archived
roadmap_item: null
issue: 699
branch: claude/project-thread-apwlpl
created: 2026-10-23
updated: 2026-10-23
archived_at: 2026-10-23
---

## Intent

Close [issue #699](https://github.com/SOFTURE/AI/issues/699): `checkCopyText` lets two dash pivots through.
A spaced dash with a number on one side only is skipped as a range, and an em dash glued to two words is not
matched at all. Report both as `dash-pivot`; keep a real range (numbers on both sides) passing.

## Context

Labels: `bug`, `pkg: blog`. Touches `modules/blog` only (`src/quality/rules/copy.ts`, copy tests, README,
CHANGELOG). Issue #700 edits the same rules file in parallel; the fresh master is merged in before the merge.
No release in this change: the coordinator releases in the next batch.

## Constraints

- Rule id, severity and message shape stay; `dash-pivot` stays copy-only.
- A range between numbers (`2020 – 2024`, `Pages 10—12`) still passes.

## Out of scope

- Changes in the adopting app (it drops its own `dash-pivot` voice phrase after the release).

## Notes

- Framing: skipped. The issue names the problem and the fix.
