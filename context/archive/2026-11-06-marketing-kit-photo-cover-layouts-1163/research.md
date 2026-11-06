---
change_id: marketing-kit-photo-cover-layouts-1163
---

# Research

- `src/og/photo-cover.ts` builds the caption alone on a transparent frame with satori, rasterises it with resvg and
  measures the drawn pixels (`findDrawnBox`) against the lower half of `getCoverBand(size)`. The same oracle works for
  any region of the band: only the bounds of the check change.
- The ink is the lighter of `colors.foreground` and `colors.background` for the text and the darker for the scrim and
  shadow (`getCoverInk`). `tone: "dark"` swaps them; `tone: "light"` equals today's default.
- The scrim is an SVG linear gradient in the composite. A top or centre position needs the gradient mirrored or
  doubled; a pill can carry its own filled rounded box (satori supports `borderRadius` and `backgroundColor`), which
  the measurement then includes, so the box itself is held to the band.
- `findMissingGlyphs(tree, fonts)` returns one entry per text in the tree, so a kicker and a title can be named apart
  in the error.
- Tests (`tests/og/photo-cover.test.ts`) already render on a black photo and find lit pixels; the same helper checks
  each layout's region.
