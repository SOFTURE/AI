---
change_id: theme-flat-paint-table-shot-784
title: "theme-flat-paint: the DataTable look and the product shot frame class (issue #784)"
status: archived
roadmap_item: null
issue: 784
branch: claude/project-thread-fhtuyc
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #784](https://github.com/SOFTURE/AI/issues/784): the Flat Paint design system documents a DataTable and
a product shot frame, but `@softure-ai/theme-flat-paint` carries them only as tokens (`--shadow-selected-row`,
`--shadow-shot-frame`), so an adopting app writes the rules itself. The package gains a `DATA_TABLE_LOOK` slot map
and a `.shot-frame` class in `page.css`.

## Context

- Labels: enhancement, `pkg: theme-flat-paint` (if present).
- `@softure-ai/ui` has no table component, so the slot map is for the app's own `<table>` markup.

## Constraints

- Built on the existing tokens only; no new token, no raw colour.
- No version bump in this change (the coordinator batches releases); CHANGELOG under `Unreleased`.
- `page.css` is also changed by a parallel change (#781): keep the addition self-contained, merge master before merge.

## Notes

- Framing: skipped. The issue names the outcome and the proposal.
