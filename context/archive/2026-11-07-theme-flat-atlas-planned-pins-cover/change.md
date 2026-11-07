---
change_id: theme-flat-atlas-planned-pins-cover
title: "theme-flat-atlas 0.3.2: solid planned pins, planned clusters, WorldMap fit=\"cover\""
status: archived
roadmap_item: null
branch: claude/project-thread-n99y8m
created: 2026-11-07
updated: 2026-11-07
archived_at: 2026-11-07
---

## Intent
On a phone, an adopting app's owner still finds planned pins hard to see (blue next to the 2 px ink stroke reads as
one dark ring) and wants them to look like the visited dots, only blue. With the intro folded on a phone, the map
should fill the whole screen height, as it does on a larger screen.

## Decisions (auto)
- A planned pin drops the ink stroke: a solid passport-blue dot of the same size with the white centre.
- `MapPinCluster` takes an optional `status`; a cluster of planned places only is passport blue.
- `WorldMap` takes `fit: "contain" | "cover"` (default `contain`); `cover` makes a fitted map `max(100cqw, 200cqh)`
  wide, so it fills the box's height and scrolls sideways.

## Notes
- research skipped: look fixes from the owner's phone screenshot, no new dependencies.

## Done
0.3.2 in the package; component tests cover the solid planned pin, the planned cluster and `fit="cover"`.
