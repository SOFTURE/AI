---
change_id: marketing-kit-brand-style
title: "marketing-kit: one brand style (corner radius, padding, shadow, border) for the caption pill, the overlay cards, the cover and the end card"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-92y9hg
created: 2026-11-10
updated: 2026-11-10
---

## Intent

An adopting app's draft shows a caption pill and keyword and list cards with sharp corners next to rounded place
cards and hook titles: the draft draws the pill and the side cards as libass's per-glyph opaque box, which has no
radius, and nothing lets the brand choose one look for all of them. Give the brand an optional `style` (corner
radius `none | s | m | l | pill`, padding `s | m | l`, shadow `none | soft`, border `none | thin`) that the draft and
the render draw the caption pill, every overlay card, the cover's pill and kicker box and the end card's call to
action with, with a per-overlay `style.corner_radius` and a caption-only radius as overrides. Without `style`, every
film draws as before.

## Constraints

- Backward compatible: no `style` on the brand and no `corner_radius` on an overlay draw exactly as 0.25.0 does.
- The same token gives the same radius in px on every element, in the draft and in the render.
- Editing rules of the adopting apps: a soft shadow under a card, never a glow; a thin border in the accent.
- Builds on the drawn side cards of the parallel change `overlay-drawn-boxes` (`getDrawnOverlayCard`); the overlay
  padding stays for the follow-up card-layout change (it moves the card geometry), here only the caption pill's.
- Tests run on fakes only; frame grabs of a fixture draft compared for the radius.

## Notes

- No frame: the gap is the adopting app's roadmap item (brand style tokens); the draft's square corners are
  reproduced in `buildFootageDraftCaptions` and `getSideTextEvents` (BorderStyle 3 boxes).
