# Plan: marketing-kit-split-screen

## Steps

1. `split-screen.ts`: `splitSchema` (`split3`, three bands `{ clip, start, label, focus? }`), band heights, the
   zig-zag places and reserved stretches, label width check, the arrow paths, the layer SVG and its PNG (resvg, hand
   font only), `writeSplitLayers`, `buildSplitScreenFilters`, `getSplitLayerInputArgs`, `getSplitCaption`,
   `findSplitCaptionProblems`.
2. `edl.ts`: `EdlSegment.split`, schema, `validateEdl` (band spans, holds still, not last, a cut after it, label
   width, captions with bounds; `EdlCaptionBounds.frameWidth`), `diffEdl` lines.
3. `picture.ts`: `PicturePiece.split`, the piece's inputs and graph through the builder, fade and drawn tails at the
   input after the split's; `pipeline.ts` writes the layers into the picture folder.
4. `draft.ts`: an input counter, the split's inputs and builder at the draft's size, `splitLayers`; the draft writes
   its layers next to its captions.
5. `overlays.ts` keeps overlays off a split; `compose.ts` throws on a split without a picture; `DRAFT_FILTERS` asks
   for `vstack`; exports, README, CHANGELOG, 0.36.0, `tools/deploy` dev range, lockfile.
6. Tests: schema, places, labels, arrows, SVG, PNG, filters, captions, validation, diff, overlays, picture and draft
   args, composition, and a real ffmpeg run comparing the draft and the picture frame by frame.

## Progress

- [x] 1 Split screen module.
- [x] 2 EDL.
- [x] 3 Picture and pipeline.
- [x] 4 Draft.
- [x] 5 Overlays, composition, tools, docs, version.
- [x] 6 25 new tests incl. a real ffmpeg draft and picture of a split (216x384): every compared frame within 4/255,
  unlike any single shot, 180 frames; typecheck, ESLint and the language gate clean.

## Decisions (auto)

- Labels and arrows are baked into the picture as one rasterised layer, not overlays: identical in both paths by
  construction, and the one-overlay-at-a-time rule stays untouched (overlays are refused over a split instead).
- Fixed zig-zag placement, no per-band side knob: the simplest that keeps the platform's header and buttons clear and
  leaves the middle band's lower half for the captions; a knob can come later.
- A split holds still and the next segment starts on a cut: the picture path's outgoing tail is one clip.
- The caption check lives in `validateEdl` behind caption bounds, so the caption code is not touched.
