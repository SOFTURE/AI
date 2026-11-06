---
change_id: theme-flat-atlas-map-polish
title: "theme-flat-atlas 0.3.1: whole outlines for planned countries, solid planned pins, flags over pins, ChipRail"
status: archived
roadmap_item: null
branch: claude/theme-flat-atlas-map-polish
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent
After the map shipped on an adopting app's home page, the owner reported four things: a place's flag hides under the
neighbouring pins, planned (blue) pins are hard to see, a planned country (China) has its outline on only part of its
border, and a long row of chips ends on a chip cut in half with nothing to say it scrolls.

## Decisions (auto)
- Planned countries are drawn last (land, then visited, then planned), so no neighbour covers the dashed outline.
- A planned pin is the same dot as a visited one (2 px ink stroke, white centre), in passport blue.
- A pin whose flag shows (hovered, focused, selected, `isTagShown`) rises above the others (`z-10`).
- New `ChipRail`: one row without a scrollbar and a round arrow at each end while there is more that way. No fade,
  because the design system forbids gradients.

## Notes
- research skipped: look fixes from the owner's screenshots, no new dependencies.

## Done
0.3.1 in the package; component tests cover the paint order, the planned pin look and its `z-10`, and ChipRail.
