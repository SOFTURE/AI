---
change_id: theme-notion-timeline-fold-907
title: "theme-notion: a folding Timeline entry and FoldRow's touch size (issue #907)"
status: in_progress
roadmap_item: null
issue: 907
branch: claude/project-thread-m7utty
created: 2026-10-30
updated: 2026-10-30
---

## Intent

Close [issue #907](https://github.com/SOFTURE/AI/issues/907): a timeline entry cannot fold open to its details, and
`FoldRow`'s summary has no touch size. Give `TimelineItem` a `fold` (a disclosure body with `aria-expanded`, at least
the touch target high) and `FoldRow` a `size="touch"`.

## Context

Labels: `pkg: theme-notion`. Runs after #902/#903 (PR #910) in the same thread; touches `src/notion/Timeline.tsx` and
`src/notion/FoldRow.tsx` only. No version bump: theme-notion joins the batched release.

## Constraints

- Backwards compatible: `Timeline` stays usable from a server component (no `"use client"` on its file); entries
  without `fold` render the same markup.
- Every exported value of a `src/notion` file is exported from the root (inventory test).

## Notes

- Framing: skipped. The issue names both options and the acceptance.
