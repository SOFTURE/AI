# Research: marketing-kit-ribbon-captions

- Styles: `CAPTION_STYLES` (`film.ts`) is `phrase | highlight`; the config schema (`schema.ts`, `captionStyle`) and
  `config.ts` pass it to `FootageFilm.captionStyle`.
- Chunks: `getFootageCaptionChunks` cuts `highlight` with `captionChunks` (4 words by default) and everything else
  with `phraseChunks`. A ribbon card holds a short line or two, like a highlight card: it takes `captionChunks`.
- Render: `composeFootage` writes each chunk as `#cap<i>.clip.caption` with a `p.pill` or `p.phrase`; the entrance
  tween (`captionEntrance`, default rise) targets `.pill`; `getCaptionFitScript` shrinks `.caption > p` to
  `captionMaxLines` by counting `clientHeight / lineHeight`.
- Draft: `buildFootageDraftCaptions` draws a `highlight` pill as drawing events (`getDrawnPill`, `getDraftBoxEvents`)
  with its lines broken by `wrapDraftLine` and the font's measured widths; `phrase` is one libass dialogue line.
  Rotation in ASS is `\org(x,y)\frz<deg>` (counter-clockwise positive); the note overlay uses the same convention and
  the render turns it by `rotate(-tilt)` (`overlay-html.ts`).
- Per-line strips in HTML: an inline span with `box-decoration-break: clone` gives each wrapped line its own box with
  its own padding, which is what the draft draws per line.
- Glyph check: `findMissingCaptionGlyphs` reads the said words; a ribbon shows them in capitals, so it must check the
  capitals (`toLocaleUpperCase` with the brand's locale).
- Not touched: the picture compositor and `edl.ts` (another change in flight edits them).
