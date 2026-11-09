---
change_id: fold-row-actions
title: "theme-notion: FoldRow actions beside the summary"
status: implementing
roadmap_item: null
issue: null
branch: claude/project-thread-4v4djk
created: 2026-11-09
updated: 2026-11-09
---

## Intent

An adopting app lists items as `FoldRow`s and wants a control on the row's right that works whether the row is open
or closed (a trash icon that deletes the item, next to its state badge). A control placed in the `summary` slot sits
inside `<summary>`: clicking it also folds or opens the row, and a button nested in the summary's own button role is
bad for assistive technology. Add an `actions` prop that renders such controls beside the `<details>`, outside the
summary.

## Scope

- `FoldRow actions?: ReactNode`: when given, the row is a wrapper `div` (`data-slot="fold-row-with-actions"`, the
  bottom border) holding the `<details>` (flex-1) and the actions (`data-slot="fold-row-actions"`), centred on the
  summary's first line (row height, or the touch target at `size="touch"`). Without it, the markup is unchanged.
- README, CHANGELOG, minor version bump (new optional prop only).

## Notes

- Research skipped: one component, its source and tests are the whole context; the need comes from an adopting app's
  list (an opened clip with a trash icon in its header).
- Frame skipped: the problem is concrete (a control inside `<summary>` toggles the row).
