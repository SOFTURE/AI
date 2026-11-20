---
change_id: theme-flat-atlas-planned-dots
title: "theme-flat-atlas 0.5.0: dotted planned countries, CountryCounter flush on a phone"
status: archived
roadmap_item: null
branch: claude/project-thread-845t8a
created: 2026-11-19
updated: 2026-11-19
archived_at: 2026-11-19
---

## Intent
An adopting app's designer finds the dashed outline of planned countries makes the map hard to read and asks for a
pattern inside the fill instead (dots, as charts with dense data mark a series). On a phone the counter's unit and
total should sit flush with the bottom of the number (no bottom padding).

## Decisions (auto)
- Planned country: land fill with a grid of passport-blue dots (SVG `<pattern>`, 4 map units, radius 1.15), the same
  white `map-edge` border as other countries. The pattern id comes from `useId`, stripped to `[A-Za-z0-9_-]`.
- `MapLegend` planned swatch: a small inline SVG with the same dots (no CSS gradient, per the flat rule).
- `CountryChip` and `PostcardStamp` of a plan stay dashed: the complaint was about the map only.
- `CountryCounter`: the unit column's `pb-2.5` applies from `md` up only.
- Version 0.5.0: the planned look changes for every app.

## Notes
- research skipped: a look change in two components, no new dependencies.

## Done
0.5.0 in the package; `components.test.tsx` covers the pattern fill, the dotted legend swatch and the counter's padding;
the class list in `theme-css.test.ts` follows.
