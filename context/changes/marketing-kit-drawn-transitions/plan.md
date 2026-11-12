# Plan: marketing-kit-drawn-transitions

## Steps

1. `drawn-transitions.ts`: `DRAWN_TRANSITIONS` (`whip`, `card`, `paper`) and their frames (14, 13, 12),
   `STUTTER_FRAMES` (5) and `STUTTER_SCALE` (1.5), `isDrawnTransition`, `getTransitionOverlapFrames` (a fade's own or the
   film's frames, a drawn transition's fixed frames, else 0), and `buildDrawnTransitionFilters` (outgoing and incoming
   labels of exactly the transition's frames, the frame's size, a label prefix) for each kind.
2. `film.ts` `CUT_TRANSITIONS` gains `whip`, `card`, `paper`, `stutter`; config describe text; `edl.ts` describe and
   `validateEdl`: a drawn transition needs the segment and the one before at least its frames, a stutter refuses a
   moving camera, a Ken Burns zoom and a stutter longer than its segment; `npm run schema`.
3. `compose.ts`: `getSegmentScales` (a stutter segment's held scale), the stutter's two `tl.set`s; the per-segment path
   (no picture) plays a drawn transition as a plain cut (documented).
4. `picture.ts`: the tail of a drawn transition like a fade's (`PictureFadeTail` gains `kind`); the piece blends with
   `buildDrawnTransitionFilters`.
5. `draft.ts`: segment streams carry a drawn transition's tail; the join splits, blends and concatenates; the stutter's
   zoom expression.
6. Tests: filter strings, validation, picture tail and args, draft args, composition stutter, and real ffmpeg runs of
   each transition through both the draft and a picture piece (frame count, a frame mid-transition differs from both
   shots, the last frame equals the incoming shot); README, CHANGELOG, 0.35.0, `tools/deploy` dev range, lockfile.

## Progress

- [x] 1 Drawn transitions module.
- [x] 2 EDL and config; `npm run schema` in the package.
- [x] 3 Composition.
- [x] 4 Picture.
- [x] 5 Draft.
- [x] 6 16 new tests incl. real ffmpeg runs of whip, card and paper through the draft and a picture piece at 216x384:
  every transition frame of the draft within 6/255 of the picture's, mid-transition neither shot, then the incoming
  shot; `npx vitest run tools/marketing-kit tools/deploy`: 2447 passed; typecheck and ESLint clean.

## Decisions (auto)

- One overlap model for every drawn transition (the dissolve's): no new timing concept, the cut's length and audio
  never change, and the draft and the picture share one filter builder, so both draw the same frames.
- The whip always moves to the left (the next shot comes from the right); a direction knob can come later.
- The stutter is a transition (it changes how a segment starts) drawn as scale, with no camera move after it.
- Frames after a `trim`, a blend or a `concat` are numbered on the film's time base (`FRAME_TIMING`,
  `settb=1/30,setpts=N`): an `fps` filter there dropped the last frame of streams whose frames carry no duration.
