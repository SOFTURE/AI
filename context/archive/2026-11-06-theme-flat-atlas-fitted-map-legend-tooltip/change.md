---
change_id: theme-flat-atlas-fitted-map-legend-tooltip
title: "feat(theme-flat-atlas): a fitted WorldMap and MapLegendTooltip"
status: archived
roadmap_item: null
issue: null
branch: claude/theme-flat-atlas-fit-legend-tooltip
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

An adopting site turned its hero into a map that is the whole screen: the page does not scroll, the map fills the space
under the intro, and the legend folds into a button with a tooltip. Both parts were the site's own code; the owner
asked for them in the design system. The outcome: `WorldMap` `isFitted` and `MapLegendTooltip`, released as 0.3.0.

## Notes

- Research skipped: both parts compose what the package has (`Button`, `MapLegend`, the map's box); the fit is a size
  container and `min(100cqw, 200cqh)`, measured in the adopting site first.
- No open issue in this repository concerns the theme (checked 2026-11-06).

## Done

- `isFitted` on `WorldMap`, `src/atlas/MapLegendTooltip.tsx` exported from the root; README rows; CHANGELOG 0.3.0;
  render tests and the class check in `theme-css.test.ts`.
