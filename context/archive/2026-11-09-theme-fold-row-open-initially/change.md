---
change_id: theme-fold-row-open-initially
title: "theme-notion: FoldRow isOpenInitially, a row the address points at renders open"
status: archived
roadmap_item: null
issue: null
branch: claude/theme-notion-fold-row-open
created: 2026-11-09
updated: 2026-11-09
archived_at: 2026-11-09
---

## Intent

An adopting app puts tabs inside an opened `FoldRow` and keeps the selected tab in the address, so the tab survives a
reload. `FoldRow` is a native `<details>` with no way to render open, so after the reload the row the address points
at is folded and its tab hidden. `FoldRow` gets `isOpenInitially`: the row renders open; the native element keeps its
own state afterwards, so the reader can still fold it.

## Context

The owner's rule for the adopting app: a control gap is fixed in the theme package, released and bumped, not worked
around locally. The name follows `TimelineItem fold.isOpenInitially` in the same package.

## Constraints

- New optional prop only; the default (closed) renders exactly as before, so no baseline or parity fixture moves.

## Notes

- Research: skipped. One attribute on the existing element; the package's own `TimelineItem` sets the naming.
- Framing: skipped. The gap and the fix are named by the adopting app's item.

## Done

`@softure-ai/theme-notion` 0.16.0: `FoldRow isOpenInitially` renders `<details open>`. README and CHANGELOG updated.
