---
change_id: marketing-kit-split-screen
title: "marketing-kit: a three-band split screen (split3) with handwritten labels and drawn arrows"
status: impl_reviewed
roadmap_item: null
issue: null
branch: claude/marketing-kit-split-screen
created: 2026-11-12
updated: 2026-11-12
---

## Intent

An adopting app's owner wants a reel to compare three places the way the reference reels do: three shots stacked in
horizontal bands, each with a small handwritten label and a drawn curved arrow pointing into the shot, while the voice
goes on. The kit's cut shows one picture at a time.

## Context

The kit draws a cut's picture in two places: the draft (`draft.ts`, one ffmpeg graph, one input per segment) and the
render's picture (`picture.ts`, one ffmpeg per segment, joined), which the composition plays as one video. The kit's
hand font (Caveat, OFL) and resvg are already shipped.

## Constraints

- An EDL without a split draws exactly as before.
- Drawn alike in the draft and the render: one band filter builder and one rasterised layer (labels, arrows, lines)
  used by both paths, so only the size differs.
- Nothing taken from third-party material: the font is the kit's own OFL font, the arrows are curves made in code.
- Editorial only: nothing turns a split on by itself; the segment's sound stays its own.
- No paid call; tests on fixtures; real ffmpeg frames where ffmpeg has it.
- Minor bump (new EDL field and exports): 0.36.0, one release shared with the ribbon captions change.

## Notes

- Frame skipped: the adopting app's roadmap item states the outcome and the measured references.
