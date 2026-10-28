---
change_id: theme-notion-safe-area-851
verdict: approved
---

# Implementation review

- Plan followed: every part the issue lists pads by the insets on the edges it touches; `DialogContent` unchanged.
- Tests: `tests/behaviour/safe-area.test.tsx` (per sheet side, close button per side, popper select, `PageFrame`)
  failed before the change and passes after; the sidebar tests assert the phone sheet no longer carries `p-0`.
- Upstream guard: each `src/ui` change is a listed delta with its reason; parity fixture refreshed
  (`UPDATE_FIXTURES=1`); `tests/tailwind-classes.test.ts` confirms every new class generates CSS.
- Desktop unchanged: in Chromium (insets 0) a bottom sheet's padding is 0 and its close button sits at 16 px / 16 px,
  as before.
- Docs: README rule on the insets and the classes for an app's own screen roots; CHANGELOG `## Unreleased` with the
  migration (drop app-side `env()` classes; own `SheetContent` padding replaces the inset).
- Design system artifact: "NOTION · Design System" versions 32-33 (bundle.js patched, bundle.css extended with the
  new utilities only, Select and Sidebar notes).

Verdict: approved.
