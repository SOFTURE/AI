---
change_id: theme-notion-checkbox-indeterminate
title: "theme-notion: Checkbox draws the indeterminate state (issue #1514)"
status: open
roadmap_item: null
issue: 1514
branch: claude/project-thread-j3s71q
created: 2026-11-26
updated: 2026-11-26
---

## Intent
A tri-state "select the whole group" checkbox in an adopting app reads as "some selected": the theme's `Checkbox`
draws `checked="indeterminate"` as a filled box with a minus sign, without an app override. Issue #1514 (`bug`,
`pkg: theme-notion`).

## Context
`Checkbox` styles only `data-state=checked`. Radix renders `data-state="indeterminate"` and `aria-checked="mixed"`
for `checked="indeterminate"`, but the theme draws the same `CheckIcon` in an unfilled outlined box, so the mixed
state looks like a second kind of "checked".

## Scope
- `data-[state=indeterminate]` gets the filled look of `checked` (`border-primary`, `bg-primary`,
  `text-primary-foreground`, dark `bg-primary`).
- The indicator shows lucide's `MinusIcon` when indeterminate, the `CheckIcon` otherwise.
- Unit tests (red first), the gallery case and its baselines, the upstream deltas, the parity fixture, README,
  CHANGELOG `Unreleased`, the "NOTION · Design System" artifact.
- Out of scope: the adopting app; other tri-state controls (`DropdownMenuCheckboxItem`).

## Decisions (auto)
- Recorded in `plan.md`.

## Notes
- frame skipped: a bug with the expected look and a proposed fix in the issue.
