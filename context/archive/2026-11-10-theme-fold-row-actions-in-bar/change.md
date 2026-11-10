---
change_id: theme-fold-row-actions-in-bar
title: "theme-notion: FoldRow actions sit inside the row's bar"
status: archived
roadmap_item: null
issue: null
branch: claude/theme-notion-fold-row-actions-bar
created: 2026-11-10
updated: 2026-11-10
archived_at: 2026-11-10
---

## Intent

An adopting app puts a delete button in `FoldRow actions`. The row's bar (the `<summary>`'s grey background when the
row is open or hovered) ends before the button, so the button reads as standing outside the row. The owner of that
app expects the control on the bar. The bar should run under the actions, with the controls at its right end, while
the actions stay outside the `<summary>` so a click never folds the row.

## Context

`FoldRow actions` arrived in 0.14.0 as a sibling of the `<details>`. The owner's rule for the adopting app: a control
gap is fixed in the theme package, released and bumped, not worked around locally.

## Constraints

- Same API; the row without `actions` renders exactly as before (no visual baseline or parity fixture moves).
- The component stays a server component: no client state, CSS only.

## Notes

- Research: skipped. One component; the structure and its tests are in `src/notion/FoldRow.tsx`.
- Framing: skipped. The gap and the fix are named by the adopting app's item.

## Done

`@softure-ai/theme-notion` 0.16.1: `FoldRow actions` share the summary's bar (open: `peer-open`; hover: the wrapper's
group). README and CHANGELOG updated.
