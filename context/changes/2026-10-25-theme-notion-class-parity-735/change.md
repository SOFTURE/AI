---
change_id: theme-notion-class-parity-735
title: "theme-notion: misplaced class strings in sidebar, checkbox, select and field; page base rules (issue #735)"
status: in_progress
roadmap_item: null
issue: 735
branch: claude/project-thread-wrn4uo
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #735](https://github.com/SOFTURE/AI/issues/735): four components of `@softure-ai/theme-notion` 0.2.0
carry a class string that belongs to a neighbouring element, and three page base rules of the design system's
`globals.css` are shipped by no stylesheet. Put the five class strings (plus the lost `SelectItem` icon colour) back
to the design system's values, cover them with regression tests, and ship the base rules.

## Context

- Labels: `bug`, `pkg: theme-notion`.
- Found while checking 1:1 parity with the design system and stock shadcn/ui new-york v4.
- UI tests exist only for alert, badge, button, table and tabs.

## Constraints

- Only the named class strings change; the rest of each file stays as it is.
- No version bump: the coordinator releases in a batch.
- No change to the theme contract in `@softure-ai/theme-kit`.

## Notes

- Framing: skipped. The issue names the exact class strings and rules.
