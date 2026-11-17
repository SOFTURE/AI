# Research: marketing-kit-draft-card-shapes

## Measured (probe on 0.42.0, kit fixture fonts, render scaled to 540x960, cards and accent red, shadows off)

| Overlay | Render card (l, t, r, b) | Draft card | Verdict |
| --- | --- | --- | --- |
| `hook_title`, `backdrop: highlight`, 2 lines | 162, 118, 377, 196 (two tight marks) | 102, 120, 437, 195 (one block) | marks 1.56x too wide, joined |
| `keyword`, highlight, wipe, wraps to 2 lines | 67, 342, 442, 434 (two marks) | 58, 340, 469, 391 (one band) | one band, one line tall; the wipe clip cuts line 2 |
| `keyword`, card, wraps to 2 lines | 42, 328, 467, 434 | 42, 328, 467, 403 | card one line tall |
| `lower_third` | 42, 702, 419, 749 | 42, 702, 407, 749 | no accent dot; text 0.81 em further left |
| `place_card` `size: s`, `subtitle_size: m` | 108, 319, 432, 412 / 114, 307, 425, 424 | 108, 318, 431, 413 / 114, 306, 425, 425 | equal (0.42.0 fixed their text) |
| `counter` 2,800 PLN | 199, 318, 340, 416 at "0" (see below) | 136, 318, 403, 413 | draft card is the resolved box, not the text's |

## Why
- The render lays a keyword's, a lower third's and a counter's card out in CSS: the card (`.ov-card`) is a flex item
  of its box (`.ov`), as wide as its text plus padding (`max-width: 100%`, wrapping), as tall as its lines; a counter's
  card is `nowrap` and follows its number while it counts. A lower third's card starts with a `.36em` accent dot and a
  `.45em` gap. A keyword's card hangs from the box's top, a lower third's stands on its foot.
- The draft and `getDrawnOverlayCard` fit a side text's card by `estimateTextWidth` (0.56 em a character) on one line,
  and draw every other card as its resolved box (also estimated).
- Highlight marks (`.ov-mark`, inline, `padding: .04em .22em`, `box-decoration-break: clone`) cover each line's
  content area: the font's ascent plus descent (hhea, or the typo metrics when `USE_TYPO_METRICS` is set), centred in
  the line's half-leading. The draft sized them by `estimateTextWidth` and the full CSS line height, one per title line
  and one for a whole keyword.
- A wrapped keyword is one ASS event with `\N`: libass spaces its lines by its own font size (win metrics), not by the
  render's 1.15 line height (Open Sans: 1.36 against 1.15).
- The test harness seeks GSAP with `seek(t)`, which suppresses callbacks: a counter's `onUpdate` never runs and the
  render shows the start value. Seeking with `seek(t, false)` runs it, as the real capture does.

## Callers here
- `getDrawnOverlayCard` is used by the adopting app (face checks, `box_percent`) and by `getRegions` in tests.
- `buildDraftOverlayEvents` gets `drawnFonts` from `buildFootageDraftCaptions` when the caller passes `fonts`.
