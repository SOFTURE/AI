# Plan: marketing-kit-segment-camera

## Steps

1. `camera.ts`: `EdlCamera` (`from`, `to`, `ease`, `seconds?`, `anchor?`), `cameraSchema`, the cap 1.6, and the helpers
   both renderers share (origin, move frames and seconds, GSAP ease, the draft's scale expression, the scale at a
   frame, `transform-origin`, comparison, a short description).
2. `edl.ts`: optional `camera` and `fadeFrames` (1-30) on a segment; `validateEdl` refuses a camera beside a Ken Burns
   zoom or a zoom cut and a fade length on another cut; `diffEdl` names both. Regenerate `edl.schema.json`.
3. `compose.ts`: a camera segment starts at `from`; `getSegmentFadeFrames`; the move as a tween with its ease and
   length; per-segment `transform-origin` (video style, or on the picture's `tl.set` when the film has a camera).
4. `picture.ts`: the fade's own length; a camera's tail held at the zoom it reached about its anchor, relative to the
   incoming camera's start (never below the full frame).
5. `draft.ts`: the fade's own length; a camera's move with `zoompan`, a still framing with a crop, about its anchor;
   a punch-in still multiplies the segment's zoom.
6. `overlays.ts`: a camera move or a new framing ends a shot; a punch-in on a camera segment is refused.
7. Tests (`camera.test.ts`), exports, README, CHANGELOG, 0.34.0, `tools/deploy` dev range, lockfile.

## Progress

- [x] 1 Camera module.
- [x] 2 EDL fields, checks, diff; `npm run schema` in the package.
- [x] 3 Composition.
- [x] 4 Picture.
- [x] 5 Draft.
- [x] 6 Overlays.
- [x] 7 23 new tests incl. a real ffmpeg draft (240 frames, 8 s; the settle on still bars moves in its first second
  and holds after); `npx vitest run tools/marketing-kit`: all pass; typecheck and ESLint clean.

## Decisions (auto)

- One optional `camera` per segment rather than new `motion` values: a framing and a move share the anchor and the
  draw path, and `motion` stays the b-roll's Ken Burns as before.
- A camera owns the scale: refused with a Ken Burns zoom or a zoom cut, and a punch-in is refused on it, so zooms
  never stack.
- The fade tail of the one picture video is baked relative to the incoming camera's start, since the composition
  zooms the whole picture during the fade; never below 1 (a fade into a tighter framing should be a hard cut; the app
  plans it so).
- The draft keeps `zoompan` (whole source pixels, about half a draft pixel at 540 wide), like Ken Burns today.
