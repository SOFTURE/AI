---
change_id: marketing-kit-overlays-across-jump-cuts
title: "marketing-kit: an overlay may run across a jump cut inside one shot"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-b87zsd
created: 2026-11-10
updated: 2026-11-10
archived_at: 2026-11-10
---

## Intent

An adopting app edits talking-head reels where the pause cuts come every few seconds. `resolveEdlOverlays` refuses
any overlay (other than a `hook_title`) that runs into the next segment, so a list that needs 4 s could last only
2 s. Across a jump cut inside one shot (the same clip, a plain cut, no Ken Burns zoom, the same caption box) the frame
does not change, so the overlay should run on; across another clip or a transition it still stops, with a reason
naming the cut.

## Context

The draft draws overlays as ASS events on film time and the render as clips of their own, so neither needs a segment
to hold an overlay; only the resolver's segment check stood in the way. A `punch_in` zooms its own segment's picture
(`#seg<N>` in the render, the segment's plan in the draft), so it keeps to one segment.

## Constraints

- Every EDL that resolved before resolves the same (only refusals turn into acceptances).
- No change to the drawing of overlays.

## Notes

- Research: skipped. One function (`resolveEdlOverlays`) and its tests; the drawing paths were read to confirm they
  are on film time (`draft-overlays.ts`, `compose.ts`).
- Framing: skipped. The adopting app's item names the rule and the done-when.

## Done

`@softure-ai/marketing-kit` 0.26.0: `resolveEdlOverlays` lets an overlay run across a jump cut inside one shot;
the refusal names the cut that breaks the shot and why; new export `findShotBreak`. `tools/deploy` accepts 0.26.0.
