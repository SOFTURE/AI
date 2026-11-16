# Plan: aside-panel-keeps-sidebar

## Approach

`AsidePanelProvider keepsSidebarOpen?: boolean` (default `false`). With it, `isSidebarShown` is the sidebar's own
state and `openSidebar` only opens the sidebar. Nothing else changes: the toggle, the panel, Escape, the kept state,
the phone sheet.

## Phases

1. Code and tests (test-after): the prop; tests named for issue #1254: opening the panel keeps the sidebar expanded,
   a kept-open panel starts with the sidebar expanded, the sidebar's trigger folds and unfolds it without touching the
   panel (and without a save), closing the panel leaves a folded sidebar folded, the opener shows only while the user
   folded the sidebar and does not close the panel, `useAsidePanel().isSidebarFolded` follows the sidebar. Default
   mode tests stay as they are.
2. Docs and release prep: README paragraph, CHANGELOG `## Unreleased` → `npm run release:version -- theme-notion minor`.

Done when: `npm run typecheck`, `npm run lint`, the theme's tests and the repository tests pass.

## Progress

- [ ] 1 Code and tests
- [ ] 2 Docs and release prep

## Decisions (auto)

- A boolean prop rather than a mode enum: two behaviours, the default one unchanged; named as a question
  (`keepsSidebarOpen`), like `isHidden`.
