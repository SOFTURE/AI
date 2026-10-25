---
change_id: theme-notion-filter-chip-737
title: "theme-notion: FilterChip, a Notion-style list filter pill (issue #737)"
status: open
roadmap_item: null
issue: 737
branch: claude/project-thread-nqq6re
created: 2026-10-25
updated: 2026-10-25
---

## Intent

Close [issue #737](https://github.com/SOFTURE/AI/issues/737): `@softure-ai/theme-notion` exports `FilterChip`, the
pill a Notion database view draws above a table (`icon · Label: value ▾`) that opens a list of options, and
`FilterChipAdd`, the "Add filter" pill of the same height. An adopting app stops styling its own trigger.

## Context

- Labels: `enhancement`, `pkg: theme-notion`.
- The package has `Select`, `DropdownMenu` and `Popover`, but no part drawn as this pill.

## Constraints

- The issue's API (`label`, `value`, `icon`, `isActive`, `children`, `className`) and look (24 px, `rounded-full`,
  `text-sm`, muted text, `hover:bg-accent`, active `bg-blue-tag text-blue-tag-foreground`, 14 px chevron, the
  design system's popover); `data-slot="filter-chip"`, `data-active`.
- Keyboard-operable, exported from the package root, English only, no version bump (batched release).

## Notes

- Framing: skipped. The issue names the outcome, the API and the look.
