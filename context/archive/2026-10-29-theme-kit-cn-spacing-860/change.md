---
change_id: theme-kit-cn-spacing-860
title: "theme-kit: createThemeCn merges the theme's named spacing tokens (issue #860)"
status: archived
roadmap_item: null
issue: 860
branch: claude/project-thread-yoxmu9
created: 2026-10-29
updated: 2026-10-29
archived_at: 2026-10-29
---

## Intent

Close [issue #860](https://github.com/SOFTURE/AI/issues/860): the `cn` from `createThemeCn(theme)` keeps both
`size-7` and `size-touch-target` (and `h-7 h-control-height`, `min-h-7 min-h-row-height`), so the winner depends on
stylesheet order. Register the theme's `sizes` names as tailwind-merge spacing values, so the later class wins.

## Context

Labels: `bug`, `pkg: theme-kit`. Runs next to #858 and #859 (theme-notion). No release in this change: the coordinator
releases theme-kit as a patch (themes depend on `^0.1.x`).

## Constraints

- Generic through the theme contract (`ThemeDefinition.sizes`), no theme-specific names in the kit.
- Backwards compatible: `createThemeCn` keeps accepting a definition without `sizes`.

## Notes

- Framing: skipped. The issue names the bug and the expected result.
