---
change_id: marketing-kit-drawn-overlay-card
title: "marketing-kit: the card a keyword, a lower third and a list draw"
status: archived
roadmap_item: null
issue: null
branch: claude/marketing-kit-drawn-overlay-card
created: 2026-11-10
updated: 2026-11-10
archived_at: 2026-11-10
---

## Intent

An adopting app reports, for each frame of a draft, where every overlay sits and whether it covers the speaker's face.
For a keyword, a lower third and a list the only box the kit exposes is the whole width the overlay may take (from the
safe zone's left margin to its right one), so a small keyword at the right edge reads as a box across the frame and
the app flags it as covering a face it does not touch. The kit should expose the card it actually draws, from one
function the draft also draws with.

## Context

The draft drew those three kinds with libass's opaque box (`BorderStyle 3`): a square box round the glyphs, padded by
0.35 em on every side, so its size came from libass's real glyph widths, which the kit cannot read back. The other
cards (hook title, search bar, place card, counter, date stamp) are already drawn rounded cards sized by
`estimateTextWidth`.

## Constraints

- Placement, refusals and the render (HTML) stay as they are; stored EDLs place the same.
- A drawn card's box must equal the function's answer, so a report never differs from the frame.

## Notes

- Research: skipped. Two files (`overlays.ts`, `draft-overlays.ts`) and their tests; the drawing code is read in full.
- Framing: skipped. The gap and the fix are named by the adopting app's roadmap item.

## Done

`@softure-ai/marketing-kit` 0.25.0: `getDrawnOverlayCard`; the draft draws keyword, lower third and list as that
rounded card with plain text over it (list points on the render's line height); the `Overlay` ASS style is gone.
README and CHANGELOG updated; `tools/deploy` dev range takes ^0.25.0.
