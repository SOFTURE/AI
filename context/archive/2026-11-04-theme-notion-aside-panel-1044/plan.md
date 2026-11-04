---
change_id: theme-notion-aside-panel-1044
status: archived
---

# Plan: AsidePanel (issue #1044)

Input: change.md, research.md. Complexity: medium (one package, one composition file, five exports).

## Phase 1: components and tests (TDD)

Files: `themes/theme-notion/src/notion/AsidePanel.tsx`, `src/messages/en.ts`, `src/index.ts`,
`tests/notion/AsidePanel.test.tsx`, `tests/behaviour/messages.test.tsx`, `tests/gallery/cases.tsx`,
`tests/fixtures/notion-slots.json`, visual baselines.

- `AsidePanelProvider({ initialState, save?, onSaveError?, isHidden?, panelId?, ...SidebarProvider props })` renders
  `SidebarProvider` with `open = sidebarOpen && !(panel open on a wide screen && !isHidden)`; its `onOpenChange(true)`
  closes the panel. `useAsidePanel()` exposes the state and actions.
- `AsidePanelState = { isOpen: boolean; width: AsidePanelWidth }`, `AsidePanelWidth = "standard" | "half"`.
- `AsidePanelToggle({ showLabel?, hideLabel?, className? })`: `aria-expanded`, `aria-controls`, `secondary` while
  open and `outline` while closed, fixed at the top-right edge.
- `AsidePanel({ title, children, widenLabel?, narrowLabel?, className? })`: wide screen `aside` (`sticky top-0 h-dvh`,
  `md:w-2/5` or `md:w-1/2`), header with a `tabIndex=-1` heading and the width switch; phone `Sheet` side right,
  opened for the page only; children render only while open (lazy body).
- `AsidePanelSidebarOpener({ label?, className? })`: shown only while the sidebar is folded on a wide screen.
- `isOverlayOpen(root)`.
- Escape on a wide screen closes the panel and focuses the toggle unless an overlay is open; opening from the toggle
  focuses the heading.
- Save: each change on a wide screen calls `save(state)`; a rejected save keeps the state and goes to `onSaveError`.
- Tests: toggle attributes and variants, open/close, save calls and failed save, width switch, sidebar handover both
  ways, opener visibility, Escape with and without open overlays (Radix `data-state`, `dialog[open]`, closed popover
  with `role="dialog"`), focus, phone sheet ignoring the kept state, hidden screens, lazy body, message overrides.

## Phase 2: docs

README section and component list, `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- Option 1 of the research: the provider owns the sidebar's open state.
- Closing the panel brings back the sidebar's own state (open unless the user folded it), so the sidebar is folded
  only while the panel is open, never left folded by it.
- A failed save is passed to `onSaveError` when given; the choice stays on the page either way.
- No version bump: the coordinator releases the batch.

## Progress

- [x] Phase 1: components and tests (70aa088)
- [x] Phase 2: docs (9569cbe)
- [x] Implementation review
