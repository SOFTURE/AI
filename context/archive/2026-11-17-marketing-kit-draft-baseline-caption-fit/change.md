---
change_id: marketing-kit-draft-baseline-caption-fit
title: "marketing-kit: the footage draft sets every line on the render's baseline and fits captions to their line limit as the render does"
status: archived
roadmap_item: null
issue: null
branch: fix/draft-text-baseline-and-caption-fit
created: 2026-11-17
updated: 2026-11-17
---

## Intent

After 0.42.0 to 0.44.0 an adopting app compared a fresh footage draft with the paid render of the same cut (a talking
head reel with a brand display serif for headings and a brand sans for captions). Two differences remained:

- A heading line stood about 0.375 em lower in the draft than in the render: a place card's title fell onto its
  subtitle, a keyword's last line hung out of its card, a hook title's text sat low in its marks, a note strip's
  letters low on their paper.
- Captions were up to 1.4 times as large in the draft: the render shrinks a chunk's font (in 1 px steps, down to
  `CAPTION_MIN_FONT_SCALE`) until it takes at most `captionMaxLines` lines; the draft kept the box's size, so a long
  chunk took three lines in the draft and two smaller ones in the render.

The draft is the render at half resolution: both must go.

## Context

- libass sets a line's baseline `usWinAscent` below the line's top (and sizes the font by `usWinAscent +
  usWinDescent`). A browser sets it half the leading plus the content area's ascent (`hhea`, or the typo metrics with
  `USE_TYPO_METRICS`) below the line box's top. For fonts whose win metrics agree with the rest (the kit's DejaVu
  Sans, Caveat) the two agree within a few px, so the regression test of 0.42.0 could not see it; a display serif
  with win ascent 1.3 em over a 1.0 em typo ascent shows it plainly. Measured on the adopting app's server with its
  ffmpeg (libass 0.17.3): an `\an8` line of such a font at 100 px has its baseline 130 px below the anchor.
- `compose.ts` writes the render's caption fit script (`getCaptionFitScript`); `film.ts` said "The draft keeps its
  font size", a decision of 0.42.0 ("rare at four words a chunk") that the adopting app's reel refutes.

## Constraints

- No change to the render's output.
- Without the draft's fonts (a caller that passes no `fonts`) nothing moves, as before.
- Fixture fonts only: the kit's DejaVu Sans Bold and Caveat; a font with a tall win ascent is made in the test by
  raising Caveat's `usWinAscent` in a temporary copy.

## Notes
- Research and frame: the cause is measured (libass baseline probe, the render's fit script, the adopting app's ASS
  and HTML), so research is folded into this file's Context and frame is skipped.

## Done
- marketing-kit 0.45.0: the draft sets every top- or middle-anchored overlay line on the render's baseline
  (`getDraftLineShift`, `getDraftMiddleShift`, `DraftFont.drawnAscentEm`, `drawnDescentEm`) and fits each caption
  chunk to `captionMaxLines` as the render does (`fitDraftCaptionPlace`).
