---
change_id: marketing-kit-drawn-transitions
title: "marketing-kit: drawn transitions between shots (whip, card, paper) and the stutter punch"
status: impl_reviewed
roadmap_item: null
issue: null
branch: claude/marketing-kit-drawn-transitions
created: 2026-11-12
updated: 2026-11-12
---

## Intent

An adopting app's owner wants reels joined like the reference reels they measured: a whip pan (the picture slides
away faster and faster under a growing motion blur, the next shot slides in and lands with a small zoom), a
grow-from-card (the next shot appears as a small tilted card and grows to fill the frame), a torn-paper wipe (a paper
texture settles over the outgoing shot, then a torn edge opens from the middle onto the next one) and a stutter punch
(a new shot shows wide for five frames, then cuts tight). The kit only knows a cut, a dissolve, a zoom cut and a
whoosh.

## Context

The kit draws a cut's picture in two places: the draft (`draft.ts`, one ffmpeg graph, `xfade` at a dissolve) and the
render's picture (`picture.ts`, one ffmpeg per segment, a dissolve's outgoing tail drawn into the incoming piece),
which the composition plays as one video and zooms. A segment's scale lives in `getSegmentScales` (composition) and
`planFootageDraft` (draft).

## Constraints

- An EDL without the new transitions draws exactly as before.
- Drawn alike in the draft and the render: one filter builder used by both paths, so the render's picture and the
  draft run the same frames (only the size differs).
- Nothing taken from third-party material: the paper's texture and torn edge are made in code (noise and sums of
  sines), the card is the incoming shot itself.
- No sound added (no whoosh with a whip); the cut's audio stays as it is.
- No paid call; tests on fixtures; real ffmpeg frames where ffmpeg has it.
- Minor bump (new transitions and exports): 0.35.0.

## Notes

- Frame skipped: the adopting app's roadmap item states the outcome and the measured references.
