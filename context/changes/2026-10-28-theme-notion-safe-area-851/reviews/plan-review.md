---
change_id: theme-notion-safe-area-851
verdict: approved
---

# Plan review

- Covers every part the issue lists: bottom/top/side sheets, the mobile sidebar, the popper select, `PageFrame`;
  `DialogContent` correctly left alone.
- Compatibility: the insets are 0 outside `viewport-fit=cover`, so desktop and browser layouts are unchanged; an app
  that passes its own padding to `SheetContent` replaces the insets (tailwind-merge), which the changelog must say.
- Risk found and handled: the sidebar's `p-0` would remove the sheet's insets through tailwind-merge.
- Close button: offset only on edges that touch the screen, so a bottom sheet keeps its button at 16 px.
- Upstream guard and fixture updated in the same phase.

Verdict: approved.
