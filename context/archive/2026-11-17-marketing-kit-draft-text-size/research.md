# Research: marketing-kit-draft-text-size

## How text is sized today
- The render (`compose.ts`, `overlay-html.ts`) sets every size as CSS px (`font-size`), the browser sizes a font by
  its em (`unitsPerEm`).
- The draft writes those CSS px unchanged into ASS: the caption styles' `Fontsize` (`buildFootageDraftCaptions`,
  `toStyle`, `CaptionShape`), and `\fs` in every overlay event (`draft-overlays.ts`: side texts, lists, chip
  numbers, cards via `text()`, the counter's unit, a note strip). Only the hand font is converted
  (`hand-font.ts`, `getHandFontAssSize`: `\fs = css * (usWinAscent + usWinDescent) / unitsPerEm`).
- libass sizes a font by `usWinAscent + usWinDescent` (VSFilter compatibility), as `draft-text-width.ts` states.

## Measured (probe, this container, libass of the system ffmpeg vs Chromium 1243)
DejaVu Sans Bold (kit fixture, win sum 2384 of 2048 units), "Afryka Hello", `\an7` at the same point, Bold=-1:

| draft `\fs` | libass ink box | Chromium at 96 px CSS |
| --- | --- | --- |
| 96 (today) | 496 x 80 (Bold=0 picked the system regular: a probe artefact) | 660 x 94 |
| 111.75 = 96 x 2384 / 2048 | 660 x 94, top 116 | 660 x 94, top 115 |
| 74.5 = 64 x 2384 / 2048 | 439 x 62 | 440 x 63 at 64 px |

The conversion makes the draft's text pixel-identical in width and height. For a font with taller win metrics
(Open Sans 2789/2048 = 1.36, Calistoga higher) the shrink today is 0.73x and less, which is what the adopting app
measured (0.64x to 0.7x).

## Line breaks
- Captions with a brand style: the draft breaks a chunk's words with `wrapDraftLine` and the font's own advances
  (`createDraftTextMeasure`), but that measure is in libass sizes (`units * size / winSum`), i.e. the small text the
  draft drew. In CSS px the words are wider and the render breaks into more lines (the adopting app's one line vs
  two).
- Phrase captions (no pill): libass wraps itself in the caption margins; with the right size its widths are the
  browser's.
- Hook titles, place cards, counters, dates, search bars, lists and chips: the render draws explicit lines with
  `white-space: nowrap` (`overlay-html.ts`), so line counts are the layout's in both paths.
- Keyword and lower third: the render's card wraps inside its box (`max-width: 100%`, `overflow-wrap: anywhere`);
  the draft draws one line. With the right size, a long keyword ("ksiazeczka = zolta febra" of the adopting app)
  is three lines in the render and one too wide line in the draft.
- The render shrinks a caption over `captionMaxLines` in 1 px steps (`getCaptionFitScript`); the draft does not.
  Rare with four words a chunk; noted, not in this change.

## Callers
- `renderFootageDraft` chooses the body font (`chooseFootageDraftFont`) and the heading and interface fonts.
- An adopting app builds preset previews and animation samples with `buildFootageDraftCaptions` directly
  (`fontFamily`, `overlayFonts`, `measure`), so the sizes must come from something it can pass too.

## Tests to lean on
- `tests/overlays-render.test.ts`: the render's composition in Chromium, seeking the GSAP timeline.
- `src/footage/place-card-centred.test.ts`: libass frames through the system ffmpeg.
