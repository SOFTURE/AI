---
change_id: theme-flat-atlas-map-controls
title: "feat(theme-flat-atlas): MapControls, the map's zoom controls"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-ns73sa
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

The theme has no zoom controls, so an adopting site drew its own: three loose outlined squares that do not belong to
the design system. The outcome: `MapControls`, plus, minus and an optional reset as one flat bar in the theme's
material, released as 0.2.0.

## Notes

- Research skipped: the parts already exist in the package (the icon button look, `line-strong`, `surface-raised`,
  lucide icons); the change composes them.
- No open issue in this repository concerns the theme (checked 2026-11-06).

## Done

- `src/atlas/MapControls.tsx`, exported from the root; README row; CHANGELOG 0.2.0; render tests and the class check
  in `theme-css.test.ts`. A screenshot of both orientations on the map ocean was checked by eye.
