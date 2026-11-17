---
change_id: theme-notion-dark-dialog-1310
title: "theme-notion: modal surfaces on popover (issue #1310)"
status: in_progress
roadmap_item: null
issue: 1310
branch: claude/project-thread-44s4me
created: 2026-11-17
updated: 2026-11-17
---

## Intent

Close [issue #1310](https://github.com/SOFTURE/AI/issues/1310): in the dark theme `DialogContent` paints itself with
`bg-background` (`#191919`), the colour of the page behind the overlay, so the dialog barely separates from the dimmed
page. A modal is a raised surface: it takes `bg-popover text-popover-foreground` (`#252525` dark, `#ffffff` light).

## Context

Labels: `pkg: theme-notion`. Package `themes/theme-notion` 0.21.0 (published). The theme already defines
`--popover` (`#ffffff` light, `#252525` dark) and uses it for menus and popovers; `sft-bridge.css` maps
`--sft-color-surface-raised` to it. The issue asks to check `AlertDialogContent` and `SheetContent` as well.

## Scope

- `DialogContent`, `AlertDialogContent`, `SheetContent`: `bg-background` becomes `bg-popover text-popover-foreground`.
- The upstream deltas and the design-system slot snapshot follow; tests assert the surface classes.
- CHANGELOG and a patch release (0.21.1); the NOTION · Design System artifact gets the same classes.

## Constraints

- Light mode renders exactly as before (`popover` = `background` = `#ffffff`, foregrounds equal).
- Tokens only; no new token.

## Notes

- Research skipped: three class strings in three components; the token values were read in `src/tokens.ts` and the
  issue gives the measured colours.
- Frame skipped: the defect and the fix are concrete.

## Decisions (auto)

- `SheetContent` changes too: it is modal under the same overlay and blends into the page the same way; every modal
  surface of the theme then sits on `popover`, as menus already do. `SidePanel` and `AsidePanel` stay on `background`:
  they are non-modal panels beside the page with no overlay.
- Patch release (0.21.1): a visual fix with no API change.
