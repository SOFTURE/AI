# Plan: theme-notion-resize-handle

## Approach

`ResizeHandle` (`src/notion/ResizeHandle.tsx`): a controlled `role="separator"` handle with pointer capture, arrow,
Home and End keys, double click to the default, `onChange` per step and `onCommit` at the end; `clampSize` helper.
`SidePanel width` through `--side-panel-width` and `sm:data-[sized=true]:w-(--side-panel-width) flex-none`.

## Phases

1. Component, prop and unit tests (`tests/notion/ResizeHandle.test.tsx`, a `SidePanel` width test): drag, limits,
   ignored pointers, keys, double click, clamp edge cases.
2. Gallery case, parity fixture, visual baselines, README, CHANGELOG 0.20.0 and the version bump.

Done when: typecheck, ESLint on the changed files, the theme's tests (1237) and the visual suite (184) pass.

## Progress

- [x] 1 Component, prop and unit tests (vitest themes/theme-notion: 1237 passed)
- [x] 2 Gallery, fixture, baselines (184 passed after update; only the four gallery.png moved), docs, 0.20.0

## Decisions (auto)

- One handle per column instead of shadcn's `Resizable` group: no dependency, works beside `SidePanel` and a map that
  takes the rest.
- The handle takes no layout width (`-mx-1 w-2`) and draws only on hover, focus and drag, so a column's own border stays
  the visible line and the layout does not shift.
- Version 0.20.0 in this change: the adopting app needs the release now.
