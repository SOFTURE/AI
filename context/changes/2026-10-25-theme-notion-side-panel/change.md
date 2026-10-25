---
change_id: theme-notion-side-panel
title: "theme-notion: SidePanel, a non-modal panel at a side of a canvas (issue #724)"
status: in_progress
roadmap_item: null
issue: 724
branch: claude/project-thread-cso2bo
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #724](https://github.com/SOFTURE/AI/issues/724): `@softure-ai/theme-notion` gets `SidePanel`, a
non-modal floating panel at a side of a canvas (a map), so an adopting app drops its own copy. The look equals the
issue's reference implementation.

## Context

- Found while moving the first adopting app onto the theme packages (0.1.1). `Sheet` is modal and blocks the canvas.
- Related: #718 (other gaps from the same adoption, handled in their own threads).

## Constraints

- English only; the close button's name comes from the package's message dictionary with a prop to replace it.
- Generic: no app-specific copy or layout beyond the four layouts the issue names.
- No release here: the coordinator batches it.

## Notes

- Framing: skipped. The issue names the API, the markup and the acceptance tests.
