---
change_id: theme-flat-atlas-designer-feedback
title: "theme-flat-atlas 0.4.0: white map, Open Sans, CountryChip flag, WorldMap country names on hover"
status: archived
roadmap_item: null
branch: claude/flat-atlas-designer-feedback
created: 2026-11-18
updated: 2026-11-18
archived_at: 2026-11-18
---

## Intent
An adopting app's designer asks for a map on a white background with stronger land contrast, Open Sans for text,
flags instead of ISO codes in the country list, and the country's name on mouse hover over the map.

## Decisions (auto)
- Light scheme `map-ocean` and `map-edge`: `#FFFFFF`; `map-land` and `land-paper`: `#B4BEB6`. Page background unchanged.
- `--font-sans` is Open Sans; Calistoga and DM Mono unchanged.
- `CountryChip` takes an optional `flag` (any node) in a 24 x 16 frame instead of the ISO code; the app ships the flags.
- `WorldMap` takes an optional `countryLabels`; only a mouse pointer shows the tag and darkens the country
  (`brightness-90`, no shadow, per the flat rule).
- Version 0.4.0, since the text face and the map palette change for every app.

## Notes
- research skipped: look changes and two additive props, no new dependencies.

## Done
0.4.0 in the package; component tests cover the chip flag, and `world-map-hover.test.tsx` covers the tag, its
position, the cases without a tag and the overlay letting events through.
