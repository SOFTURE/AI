---
change_id: theme-notion-command-input-809
title: "theme-notion: CommandInput accessible name and trailing content (issue #809)"
status: open
roadmap_item: null
issue: 809
branch: claude/project-thread-hs7crg
created: 2026-10-26
updated: 2026-10-26
---

## Intent

Close [issue #809](https://github.com/SOFTURE/AI/issues/809): the combobox of a command palette built from
`@softure-ai/theme-notion` has an accessible name, and an app can place trailing content (an `Esc` key) inside the
input row and size that row without reaching into the component's wrapper from the parent.

## Context

- Found while adopting theme-notion 0.4.0 in an adopting app (a ⌘K search palette).
- File: `themes/theme-notion/src/ui/command.tsx` (a shadcn new-york v4 copy with listed deltas).

## Constraints

- Additive only: without the new props the rendered classes stay as they are (the design system slot snapshot pins
  them).
- English only; the README and CHANGELOG say what the app can drop.
- No version bump: the coordinator releases theme-notion. #795 (PR #797) also edits the CHANGELOG: master is merged
  in before the merge.
- theme-notion stays consistent with the "NOTION · Design System" artifact.

## Notes

- Framing: skipped. The issue names both gaps and the expected API.
