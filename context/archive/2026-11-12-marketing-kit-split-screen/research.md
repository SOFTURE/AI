# Research: marketing-kit-split-screen

- A segment's picture is read from one clip at one seek in both paths (`buildFootageDraftArgs` inputs one per segment
  and puts the sound after them at index `segments.length`; `buildPicturePieceArgs` reads `[0:v]` and a fade's tail
  at `[1:v]`). A split needs three seeks and a layer, so both need an input counter instead of the index.
- Labels and arrows: the overlay layer (`draft-overlays.ts` ASS, `overlay-html.ts` HTML) allows one overlay at a time
  and has no per-band anchor. Baking them into the picture as one transparent PNG keeps the two paths identical by
  construction: resvg (already a dependency for OG images) loads the kit's `HAND_FONT` file and draws the SVG at each
  path's size; ffmpeg loops it (`-loop 1`) and lays it over a `vstack` of the three cropped bands. Prototype at
  1080x1920 with test sources: correct, under a second.
- An `fps` after `overlay` drops the last frame (the overlay's frames carry no duration, as noted for
  `FRAME_TIMING`): numbering the frames first (`setpts=N`) keeps all of them (measured: 179 → 180 frames).
- Fades and drawn transitions: the incoming piece can be the split stream; the outgoing tail of a split would be one
  clip again in the picture path (it re-reads the previous clip), so the segment after a split must start on a cut.
- The end card's backdrop (`buildLastFrameArgs`) reads the last segment's clip: a split cannot end the cut.
- Captions: the caption preset's foot (420 px above the frame's foot in a 1920 px frame) lands on the bottom band's
  arrow, so a split segment needs its own caption box; the lower half of the middle band is free with the zig-zag
  placement. The check runs in `validateEdl` when caption bounds are given (an app's edit path), keeping the caption
  code untouched (the ribbon captions change works there in parallel).
