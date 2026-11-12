---
change_id: marketing-kit-segment-camera
title: "marketing-kit: a segment's camera (push-in, pull-out, settle, framing) and a fade's own length"
status: impl_reviewed
roadmap_item: null
issue: null
branch: claude/marketing-kit-segment-camera
created: 2026-11-12
updated: 2026-11-12
---

## Intent

An adopting app's owner wants every reel to move: slow push-ins on a talking head, a pull-out under the opening and at
the end, a settle that eases back to the full frame, and pieces of one shot alternating their framing so a jump cut
reads as a change of camera. The kit only knows a zoom cut (a punch-in on alternate jump cuts) and a Ken Burns zoom on
b-roll, both about one fixed point. The kit should let a segment carry its own framing and a slow move about an
anchor (a face), drawn alike by the draft and the render, and let a fade cut set its own, shorter length.

## Context

The scale is drawn in three places: the draft (`draft.ts`, `zoompan` or a crop per segment), the render's picture
(`picture.ts`, a fade's outgoing tail baked at the zoom it ends on) and the composition (`compose.ts`, GSAP tweens on
the one picture video, `transform-origin: 50% 42%`). Overlays treat a Ken Burns zoom as a shot break and refuse a
punch-in on it (`overlays.ts`).

## Constraints

- An EDL without the new fields draws exactly as before (same filters, same markup).
- Eases only (`linear` or `power1.out`), never past the target; scale 1 to 1.6; the crop never leaves the frame.
- No paid call; tests on fixtures; real ffmpeg frames where ffmpeg has it.
- Minor bump (new fields and exports): 0.34.0.

## Notes

- Research is short (`research.md`): the files are the three renderers above, the EDL and the overlays' guards.
- Frame skipped: the adopting app's roadmap item states the outcome and the owner's words.
