# Plan: marketing-kit-ribbon-captions

## Steps

1. `film.ts`: `CAPTION_STYLES` gains `ribbon`; `FootageFilm.captionRibbonTilt` (degrees counter-clockwise, -10 to 10,
   default `CAPTION_RIBBON_TILT` 4); geometry constants `CAPTION_RIBBON` (line height 1.42, strip padding 0.1 x 0.32
   em, radius 6 px, weight 800). Schema (`captionStyle` description, `captionRibbonTilt`), `config.ts`, JSON schema.
2. `captions.ts`: `ribbon` cut like `highlight` (`captionChunks`); `toCaptionDisplayText` (capitals in the locale);
   `getRibbonCaptionExtent(fontSize, tilt, width, lines)` for adopting apps that keep the block off a face.
3. Render (`compose.ts`): `p.ribbon` with one `span.rb` (strips per line via `box-decoration-break: clone`), the
   caption box turned by `rotate(-tilt)`, entrance tween on `.ribbon`, fit script also reaches it.
4. Draft (`draft.ts`): per chunk, lines broken by `wrapDraftLine` on the capitals, one strip drawing per line
   (`getDraftBoxEvents`, flat) and one centred text line per line, all turned about the block's middle
   (`\org`, `\frz`).
5. Glyph check reads the capitals for `ribbon` (`pipeline.ts`).
6. Tests (`caption-ribbon.test.ts`): schema range and default, chunks, markup and CSS, draft events and rotation,
   unchanged output without the style, libass frames; README, CHANGELOG (0.36.0, shared with another change).

## Progress

- [x] 1 Style, constants, schema (`npx tsx tools/marketing-kit/scripts/write-schema.ts`).
- [x] 2 Chunks, display text, extent.
- [x] 3 Render.
- [x] 4 Draft (the draft also measures the font for a ribbon without a brand style).
- [x] 5 Glyph check.
- [x] 6 `npx vitest run tools/marketing-kit/src/footage/caption-ribbon.test.ts tools/marketing-kit/tests/footage-config.test.ts`
  green (libass frames: strips darken the rows, the block rises to the right); `tests/caption-ribbon-render.test.ts`
  green in Chromium (one strip per wrapped line, the turn's matrix); a draft frame and a render frame of one card
  compared side by side: same lines, strips and turn, the draft's letters a little smaller (libass sizing, as for
  the pill). Version 0.36.0 (shared with the split-screen change), `tools/deploy` dev range, lockfile.

## Decisions (auto)

- The draft draws the ribbon's letters at the caption font size like every other caption style (libass sizes a font
  by its ascent and descent), not scaled to the render's: the captions keep one sizing rule.

- A ribbon lights no word: the reference look is still text; `captionHighlightStyle` is ignored, as for `phrase`.
- Strips take `captionBackground` and the text `captionText` (an app passes a translucent dark background for the
  usual look); no paper texture, which would read as generated.
- The block turns about its middle, so a block anchored by its foot dips a little below it: `getRibbonCaptionExtent`
  reports how far, for apps that place captions off a face.
