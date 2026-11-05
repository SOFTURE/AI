---
change_id: theme-notion-aside-panel-1075
status: archived
---

# Plan: AsidePanel follow-ups (issue #1075)

Input: change.md, research.md. Complexity: small (one component file, its tests, docs).

## Phase 1: components and tests (TDD)

Files: `themes/theme-notion/src/notion/AsidePanel.tsx`, `tests/notion/AsidePanel.test.tsx`.

- `AsidePanelToggle({ icon?: LucideIcon })`: when given, drawn in both states (with `aria-hidden` and
  `ICON_STROKE_WIDTH`); the default pair stays otherwise.
- The `aside` gets `max-md:hidden` before the app's `className`.
- `title` equals `aria-label` on the toggle, the width switch and the sidebar opener.
- `AsidePanel({ description?: string })`: a `SheetDescription` under the sheet title, `aria-describedby` set by Radix;
  without it the sheet keeps `aria-describedby={undefined}`.
- Tests: custom icon in both states, default icons, `max-md:hidden` on the aside with a kept open panel on the server
  render path (wide-screen render), `title` on all three buttons following the state, description present and absent.

## Phase 2: docs and release

README `AsidePanel` section, `CHANGELOG.md` entry, version bump 0.13.0 (released on its own after merge).

## Decisions (auto)

- One `icon` prop of type `LucideIcon` (research option 1).
- The aside is guarded by `max-md:hidden` rather than a separate `asideClassName`: it fixes every app with no API.
- The description shows on the phone sheet only, as the issue asks.

## Progress

- [x] Phase 1: components and tests (2b57ac9)
- [x] Phase 2: docs and release (1e6dc59)
- [x] Implementation review
