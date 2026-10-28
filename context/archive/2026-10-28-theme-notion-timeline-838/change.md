---
change_id: theme-notion-timeline-838
title: "theme-notion: Timeline, dated entries on a vertical rail (issue #838)"
status: archived
roadmap_item: null
issue: 838
branch: claude/theme-notion-timeline-838
created: 2026-10-28
updated: 2026-10-28
archived_at: 2026-10-28
---

## Intent

Close [issue #838](https://github.com/SOFTURE/AI/issues/838): a `Timeline` composition in `@softure-ai/theme-notion`,
so an app draws a dated sequence (a trip's stays and moves, an order's history) as entries on one continuous rail
instead of list rows with coloured left borders.

## Context

Labels: `pkg: theme-notion`. An adopting app's trip timeline is the first consumer. The component is mirrored in the
"NOTION · Design System" artifact. No release in this change: the release is a separate version bump.

## Constraints

- Server-safe (no hooks, no client directive), like `Steps`.
- Literal class names per palette colour; tokens only.
- A clickable body never nests the aside's own buttons; the button's name contains its visible text (axe
  `label-content-name-mismatch`).

## Notes

- Framing: skipped. The issue names the problem and the API.
