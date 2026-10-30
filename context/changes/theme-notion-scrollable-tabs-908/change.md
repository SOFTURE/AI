---
change_id: theme-notion-scrollable-tabs-908
title: "theme-notion: a scrollable TabsList and ScrollArea's horizontal bar (issue #908)"
status: in_progress
roadmap_item: null
issue: 908
branch: claude/project-thread-m7utty
created: 2026-10-30
updated: 2026-10-30
---

## Intent

Close [issue #908](https://github.com/SOFTURE/AI/issues/908): a tab strip wider than a phone screen cannot scroll
sideways, and a `Tabs` root in a grid or flex parent widens the page. Give `TabsList` a `scrollable` option that
keeps to its container, scrolls and centres the active tab, and `ScrollArea` a horizontal bar.

## Context

Labels: `pkg: theme-notion`. Runs after #907 in the same thread and ships in the same pull request (both
theme-notion, no shared files). No version bump: theme-notion joins the batched release.

## Constraints

- Backwards compatible: lists without `scrollable` render the same; the `Tabs` root's new class acts only around a
  scrollable list.
- Every changed line of `src/ui` is listed in `tests/upstream/deltas.ts`; every cva option is drawn in the gallery.

## Notes

- Framing: skipped. The issue names the props and the acceptance.
