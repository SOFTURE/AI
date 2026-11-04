---
change_id: marketing-kit-render-memory-1030
verdict: approved
---

# Implementation review: marketing-kit-render-memory-1030

- Matches the plan: `picture.ts` (plan, piece and join arguments), `composeFootage` with `assets.picture`,
  `renderFootage` builds the picture in the `assets` stage and passes `workers` / `lowMemory`.
- Frame alignment: piece lengths come from rounded film-frame boundaries of `getSegmentStarts`, so they sum to the
  cut's frames (test) and never drift against the speech track. A clip shorter than its piece holds its last frame.
- Fades: the outgoing tail starts at the outgoing segment's end and keeps its zoom (zoom cut or Ken Burns end scale),
  as the per-segment composition plays it; the incoming segment of a fade always starts at scale 1
  (`getSegmentScales`). The only visible difference is stated in the CHANGELOG.
- hyperframes copies the video's computed transform to its injected frame, so `tl.set` / Ken Burns tweens on the one
  video render as before (checked frame by frame on the measurement film).
- Abort: each piece is a `runFfmpeg` with its output removed on abort; the pieces' folder lives in `assets/`, which
  every render clears first.
- Not reachable from the kit and documented: the renderer's growth per captured frame inside hyperframes/Chrome.
- No findings to fix.
