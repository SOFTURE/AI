# Research: marketing-kit-overlay-polish

- `getOverlaySafeZone` gives a 9:16 film its caption preset's zone (`all`: left 60, right 150). Centred placements:
  `placeCard` (hook title, place card, search bar, counter; date stamp is sided), `placeEndWord`, `placeSideText`
  (a centred stack, a keyword with `align: center`, chips via `placeChipRow`). Each centres in
  `zone.left + margin .. frame.width - zone.right - margin`: 45 px left on `all`, 30 px on `reels`.
- The captions (`getCaptionLayoutForPreset`) use `Math.max(zone.left, zone.right)` on both edges.
- Fit checks use the zone's whole width; narrowing it for every card would refuse long titles that fit today.
- Chips: one card per point, `getListItemTimes` gives each its second (all with the card unless staggered). The draft
  draws each chip's card and one text event; the render one `.ov-chip` per point with a visibility set and entrance.
- The note: `placeNote` puts it on `style.side ?? "left"`, tilted 3 degrees (strip 2).
