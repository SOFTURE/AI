---
change_id: theme-notion-sortable-752
---

# Research: theme-notion sortable list (issue #752)

Read on master 422fac9.

- Compositions live in `themes/theme-notion/src/notion/`, re-exported by name from `src/index.ts`; interactive ones
  are tested with `@testing-library/react` under `happy-dom` (`tests/notion/SidePanel.test.tsx`), static ones with
  `renderToStaticMarkup`. Client files start with `"use client"` (`src/ui/sidebar.tsx`).
- `softureTheme.sources` lists `./ui` and `./notion`, so literal classes in a new `src/notion/` file reach the app's
  CSS without an app-side `@source`. Presence attributes are styled as `data-[active]:…` (`FilterChip`).
- Tokens for the lifted look exist: `accent-strong` (selected and pressed), `shadow-menu` (things that float).
- Built-in copy lives in `src/messages/en.ts` as plain strings; components default a prop to it and the README "Copy"
  paragraph lists every such prop.
- `@dnd-kit/core` 6.3.1 (peer `react`, `react-dom` >= 16.8) and `@dnd-kit/sortable` 10.0.0 (peer `@dnd-kit/core`
  ^6.3.0), both depending on `@dnd-kit/utilities` ^3.2.2: headless, no styles, MIT. What the issue needs is native
  there:
  - `MouseSensor` / `TouchSensor` with `activationConstraint: { delay, tolerance }`: movement beyond the tolerance
    before the delay cancels the drag, so a swipe scrolls and a tap clicks;
  - `KeyboardSensor` with `sortableKeyboardCoordinates`: Space or Enter picks up, arrows move, Escape cancels;
  - `accessibility.announcements` (`onDragStart`, `onDragOver`, `onDragEnd`, `onDragCancel`) and
    `accessibility.screenReaderInstructions.draggable` for localised live-region text;
  - `useSortable` returns `attributes`, `listeners`, `setActivatorNodeRef` (a handle), `transform`, `isDragging`;
  - a modifier is a plain function of the transform, so the vertical-only move needs no `@dnd-kit/modifiers`;
  - `DndContext` takes an `id`, so `useId()` keeps its describedby ids equal on server and client.
