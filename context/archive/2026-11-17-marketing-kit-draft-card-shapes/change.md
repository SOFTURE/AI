---
change_id: marketing-kit-draft-card-shapes
title: "marketing-kit: the footage draft draws every overlay card in the render's size and shape"
status: impl_reviewed
roadmap_item: null
issue: null
branch: claude/marketing-kit-draft-card-shapes
created: 2026-11-17
updated: 2026-11-17
---

## Intent

After 0.42.0 the footage draft draws every text at the render's size, but an adopting app still sees cards of a
different size and shape in the draft (540x960, libass) and the render (1080x1920, Chromium) of the same cut: a
highlighted hook title's bands are wider than its text in the draft and hug the letters in the render; a keyword that
wraps to several lines keeps a one-line card (and a one-line highlight band) in the draft; a counter's card is far
wider in the draft than in the render. The app also reports where each card stands (`getDrawnOverlayCard`) to check
it against a face, and that box was the one-line, estimated card. The draft and the box report should be the render's
cards: one layout, measured by the brand's own fonts.

## Scope

- A shared card layout measured by the draft's fonts: keyword and lower third cards wrapped and as tall as their lines,
  a counter's card fitted to its number and unit, highlight marks fitted to each line's text; `getDrawnOverlayCard`
  takes that measure so a caller reports the render's card.
- The draft draws those cards: a wrapped side text's lines one CSS line apart, a lower third's accent dot, a counter's
  card following its number, highlight marks per line, sized by the font's content area.
- Package-level tests: unit tests of the layout and a Chromium vs libass regression test of the card boxes.

## Out of scope

- Animation timing (another change). The preset preview's move to the draft fonts (the adopting app).

## Notes
- Frame skipped: the problem is the adopting app's measurement; this change measured it again on the kit's fixture
  (research.md).
