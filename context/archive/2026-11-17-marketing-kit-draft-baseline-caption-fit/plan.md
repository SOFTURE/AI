# Plan: marketing-kit-draft-baseline-caption-fit

## Approach
`DraftFont` gains `drawnAscentEm` and `drawnDescentEm` (libass's baseline offsets, from `usWinAscent`/`usWinDescent`,
else `hhea`). Two pure helpers turn them into a px shift: `getDraftLineShift(font, cssPx, lineHeightEm)` for a line
placed by its top in a CSS line box, `getDraftMiddleShift(font, cssPx)` for one placed by its middle. The overlay
context exposes them per role (`lineShift`, `middleShift`, 0 without fonts); every card, side text, list and note
strip line adds its shift. Captions: `fitDraftCaptionPlace` shrinks a chunk's font in 1 px steps until
`wrapDraftLine` gives at most `captionMaxLines` lines of the pill's text width, down to
`round(box size * CAPTION_MIN_FONT_SCALE)`, as `getCaptionFitScript` does; a fitted size gets its own caption style.

## Phases
1. **Helpers (TDD).** `draft-text-baseline.test.ts`: shifts for a display serif, a shorter ascent, a font without
   metrics, the kit's fonts' read values; the fit's no-limit, empty, fits, shrinks and floor cases. Done when green.
2. **Overlays and captions.** Wire the shifts and the fit. Done when the unit tests and the kit suite are green.
3. **Regression test.** `tests/draft-matches-render.test.ts` runs a second scenario: Caveat with `usWinAscent` raised
   by 0.4 em as the heading font and `captionMaxLines: 2` with a chunk of three lines at the box's size; tops and
   feet within 1 % of the frame. Done when it fails on master's code and passes with the change.
4. **Release.** CHANGELOG, version 0.45.0.

## Progress
- [x] 1 Helpers: `getDraftLineShift`, `getDraftMiddleShift`, `fitDraftCaptionPlace`; 14 unit tests green.
- [x] 2 Wiring: `lineShift`/`middleShift` in the overlay context; captions fitted with their own styles.
- [x] 3 Regression: with master's `src` the new scenario fails 12 of 12 (hook title top 144 vs 129, keyword 329 vs
  310, counter 323 vs 312, place card lines 1 vs 2); with master's `draft.ts` only, captions 4 lines vs 2 (4 of 12).
  With the change 26 of 26 pass (`PLAYWRIGHT_CHROMIUM_PATH=… npx vitest run tools/marketing-kit/tests/draft-matches-render.test.ts`).
- [x] 4 CHANGELOG and 0.45.0.

## Decisions (auto)
- Horizontal tolerance stays 2 % in the new scenario (kerning is not read: 6 to 8 px of 540 on long lines); only the
  vertical bar is tightened to 1 %.
- Ribbon captions are not fitted: the render's fit script reads `.caption > p`, the ribbon draws its own strips.
- libass's own line pitch inside a multi-line caption (one libass size per line) stays: the line count and size now
  match; the pill's height is a follow-up if an adopting app needs it.
