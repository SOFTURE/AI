# Research: highlight box (issue #1199)

- Render: `footage/compose.ts` lights a word by tweening `color` of `#cw<i>_<j>` from `captionText` to
  `captionHighlight` at its start and back after 0.32 s. The pill is `.pill` (`getCaptionPillCss`, radius 22 px),
  words are `inline-block` spans; vertical padding on them would grow the line, so the box must be an absolutely
  positioned child behind the text (the pill becomes a stacking context with `z-index:0`, the box `z-index:-1`).
- Draft: `footage/draft.ts` `buildHighlightEvents` writes one ASS event per light change, the pill drawn by
  `BorderStyle 3` (libass draws that box per glyph, grown by `Outline`, coloured by `\3c` and `\3a` per glyph). A box
  behind one word is therefore the same text on a layer above the pill with every glyph's box transparent but the lit
  word's, a smaller `\bord`, and the text on a third layer on top with its box transparent.
- Colours: `COLOR_ROLES` are all required by `resolveBrandColors`; two new roles must be optional or every brand
  without them breaks.
- Cover: `og/photo-cover.ts` `getCoverInk` refuses a kicker accent under 3:1 against the scrim; the `pill` accent is
  already a box. Contrast helpers (`getLuminance`, `getContrast`) are private there; the footage check needs them too.
