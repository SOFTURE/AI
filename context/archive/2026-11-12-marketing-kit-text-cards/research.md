# Research: marketing-kit-text-cards

- Shape: `overlay-schema.ts` lists kinds, entrances and per-kind field and style rules (`checkOverlayFields`,
  `checkOverlayStyle`); `scripts/write-schema.ts` regenerates `schema/edl.schema.json`.
- Place: `overlays.ts` `resolveEdlOverlays` → `placeOverlay` → `placeSideText` (keyword) / `placeCard` (hook_title);
  `findTimingProblems` keeps one counted overlay at a time and lets a hook title share the screen (top band).
  `getCaptionBand`/`getTextRegion` keep text off the captions; titles wrap with `fitTitle`.
- Render: `overlay-html.ts` builds clips with GSAP tweens; typing hides `.ch` spans (`display:none` for centred
  lines, opacity for left ones) and a tween staggers them visible (`getTypingTweens`).
- Draft: `draft-overlays.ts` writes ASS events on layers 3 (shapes) and 4 (text); typing is a run of events
  (`getTypedSteps`); cards are drawn rounded rects (`getRoundedRectDrawing`), rotation would need `\frz` with `\org`.
- Fonts: the draft copies chosen font files into `draft/fonts` (libass `fontsdir`); the render's `copyFonts` writes
  `assets/fonts/N.ttf` and `fontFaces` emits `@font-face`. `findMissingCaptionGlyphs` checks overlay text per brand
  font role (`getOverlayTextsByRole`).
- Speech times: the film's words in film time (`remapWords`) are already passed to the resolver (`input.words`).
- Risks: libass and Chromium measure text differently (the existing estimate `OVERLAY_CHAR_EM` is shared by both
  paths, and the tests already compare libass frames to reported boxes within 2 %).
