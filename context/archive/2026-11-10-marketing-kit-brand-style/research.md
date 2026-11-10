# Research: marketing-kit-brand-style

## How it works today
- Draft captions (`footage/draft.ts`, `buildFootageDraftCaptions`): a `highlight` chunk is drawn with style
  `BorderStyle 3`, outline 16: libass's opaque box around the text, square corners; the `box` lit word sits on layer
  1, the text on layer 2. A `phrase` caption is outlined white text (no pill).
- Draft overlays (`footage/draft-overlays.ts`): keyword, lower third and list use the `Overlay` style (BorderStyle 3,
  square); the parallel `overlay-drawn-boxes` change replaces it with a drawn rounded card (`getDrawnOverlayCard`,
  `getSideCardRadius`). Hook title, place card, counter and date stamp draw `getRoundedRectDrawing(box, fontSize *
  0.42)`; the search bar a full pill.
- Render (`footage/compose.ts`, `footage/overlay-html.ts`): `.pill` has `border-radius:22px`, padding
  `CAPTION_PILL_PADDING` (16 x 28 px), `box-shadow:0 14px 44px rgba(0,0,0,.5)`; `.ov-card` `.42em` radius and a
  shadow; the full end card's `.url` a 999 px pill; the logo end card has no box.
- Cover (`og/photo-cover.ts`): the `pill` layout's box radius = its font size; the kicker box `KICKER_BOX_RADIUS`.
- `FootageBrand` (`footage/pipeline.ts`) carries colours, fonts, logo; the draft takes `brand.colors` and
  `brand.fonts`.

## Measuring the pill in the draft
libass sizes a BorderStyle 3 box itself, so a drawn rounded pill needs the text's width. The draft's caption font is
a static TrueType or OpenType file (`chooseFootageDraftFont`); `og/font-tables.ts` already reads its tables. Advance
widths come from `hmtx` through `cmap`; libass (VSFilter-compatible) scales a font so `usWinAscent + usWinDescent`
(OS/2, else hhea) equals the font size, so a line is `fontSize` tall and an advance is `advance * fontSize /
(winAscent + winDescent)`. Kerning is ignored (a few px on a line; the padding absorbs it). A font that cannot be
read falls back to the `OVERLAY_CHAR_EM` estimate.

## Risks
- Collision with `overlay-drawn-boxes` (same files `draft-overlays.ts`, `overlays.ts`): agreed with that change to
  build on its `getDrawnOverlayCard` and swap its `getSideCardRadius` for the token; released after it.
- Wrapping: libass wraps itself; the drawn pill needs the same lines, so the draft breaks the lines itself (greedy
  by measured width, as the render's browser does) and gives libass explicit `\N`.
