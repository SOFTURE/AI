---
change_id: theme-notion-badge-fit-864
title: "theme-notion: Badge and Status fit a narrow container, Status ends in an ellipsis (issue #864)"
status: archived
roadmap_item: null
issue: 864
branch: claude/project-thread-6001oe
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #864](https://github.com/SOFTURE/AI/issues/864): `Badge` has no width limit and `Status` renders its
word as a bare text node, so a longer state text in a narrow container (a grid card, a table cell) makes the badge
wider than its parent. A badge never leaves its container; a `Status` whose word does not fit ends it in an ellipsis
inside the badge and keeps its icon.

## Context

Labels: `bug`, `pkg: theme-notion`. No release in this change: the coordinator releases in the next combined release.
Issues #858, #859 (theme-notion) and #860 (theme-kit) run in parallel.

## Constraints

- A badge whose text fits looks exactly as before (no visual baseline moves).
- The `Badge` file stays the pinned shadcn upstream plus listed deltas.
- The NOTION · Design System artifact mirrors the change.

## Notes

- Framing: skipped. The issue names the problem and the fix.
