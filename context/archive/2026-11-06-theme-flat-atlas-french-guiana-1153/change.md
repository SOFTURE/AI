---
change_id: theme-flat-atlas-french-guiana-1153
title: "fix(theme-flat-atlas): draw French Guiana as its own shape (#1153)"
status: archived
roadmap_item: null
issue: 1153
branch: claude/project-thread-ns73sa
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close #1153. Natural Earth 1:110m keeps French Guiana inside the France multipolygon (ISO numeric 250), so a site
that marks France as visited paints French Guiana too. The design system says overseas parts stay unpainted. The
outcome: French Guiana is a shape of its own (254) in `WORLD_COUNTRY_SHAPES`, released in 0.1.1.

## Notes

- Research skipped: the cause is known from the data (one France polygon lies in South America) and the fix is local
  to the generator.

## Done

- `scripts/build-world-map.ts` splits the France polygons west of 30° W into a `254` "French Guiana" shape;
  `src/map/world-110m.ts` regenerated (fit and graticule unchanged); a test checks both shapes.
