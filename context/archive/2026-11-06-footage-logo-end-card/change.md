---
change_id: footage-logo-end-card
title: "marketing-kit: a footage end card of any length (1-3 s) and a short logo card with the music fading out under it"
status: archived
roadmap_item: null
issue: 1173
branch: claude/project-thread-qhumwo
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent
Issue #1173: an adopting app wants an optional short brand card at the end of a footage reel: the logo and one short
line, 1.0 to 1.5 s, a 0.2 s fade in, no speech, the music playing on and fading out to the film's end. Today the
footage end card is a fixed 3 s headline/url/note card.

## Scope
- `endCard.seconds` (1-3, default 3) for the existing card; `getFootageFilmSeconds`, the paid-step estimate and the
  dry run follow it.
- `endCard.layout: "logo"`: the logo (its own `logo` file, PNG or SVG, else `brand.logo`; the brand name without one)
  and one optional `line`, over the brand background, fading in over `fadeSeconds` (default 0.2), inside the 9:16
  platform safe zone, the logo never upscaled past its own pixels (SVG drawn as a vector).
- The music fades out over the logo card to the film's end; the speech ends with the cut; the mix's loudness pass is
  unchanged and covers the card.
- The glyph check covers the card's line.

## Decisions (auto)
- The logo card is a layout of the same `endCard` field (a discriminated union on `layout`, `"full"` by default), not
  a second field: a film has one end card.
- Default length of the logo card: 1.5 s (the issue's upper bound); default of the full card stays 3 s.
- The card's own `logo` (PNG or SVG) instead of widening `brand.logo`, which the OG images and screen films read as SVG.
- The full card at under 3 s compresses its staggered entrances in proportion, so every line is on screen before the end.
- The pop sound effect is skipped when it would start after the film's end.

## Notes
- frame skipped: the issue states the problem and the expected behaviour.

## Done
Next marketing-kit release (batched with #1170, #1172, #1174): `endCard.seconds` for the full card and the
`layout: "logo"` card with its own PNG or SVG logo, fade in, safe zone and the music fading out under it.
