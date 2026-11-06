# Plan: theme-flat-atlas-map-controls

## Phases

1. `MapControls`: a `role="group"` bar (name from `label`), 40 px buttons with 18 px lucide icons (`Plus`, `Minus`,
   `RotateCcw`), hairline dividers in `border`, outline `line-strong`, `surface-raised`, `rounded-control`; no shadow.
   Reset only with both `onReset` and `resetLabel`; `isAtMaxZoom`, `isAtMinZoom`, `isAtStart` disable buttons;
   `orientation` vertical (default) or horizontal.
2. Tests: markup (names, count, disabled states, orientation) and the new classes compiled by Tailwind.
3. README, CHANGELOG, version 0.2.0.

## Progress

- [x] 1. Component (`src/atlas/MapControls.tsx`).
- [x] 2. Tests (`npx vitest run themes/theme-flat-atlas`: 73 passed); screenshot checked.
- [x] 3. Docs and version.
