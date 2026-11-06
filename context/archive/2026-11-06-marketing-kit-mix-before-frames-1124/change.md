---
change_id: marketing-kit-mix-before-frames-1124
title: "marketing-kit: the footage mix is built, solved and gated before the frames, at a fixed ceiling, in at most two encodes (issue #1124)"
status: archived
roadmap_item: null
issue: 1124
branch: claude/project-thread-v2vwkm
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

Close [issue #1124](https://github.com/SOFTURE/AI/issues/1124): with high-crest, transient-rich speech and
`mixLoudness: { target: -14, truePeak: -1, tolerance: 1, keep: "speech" }` the mix stage's loop moves the gain and the
limiter's ceiling together, the limiter takes back what the gain added, and the film fails after every frame was
rendered. The adopting app needs:

1. a mix stage that converges in at most two encodes on that material, keeping `keep: "speech"`'s meaning;
2. `mixLoudness.attempts` (default as today, 4);
3. `mixLoudness.warnTolerance`: a finished mix inside `target ± warnTolerance` and at most `truePeak` finishes with
   `loudness.warning` (a sentence naming both values) instead of an error; the true peak limit is never relaxed;
4. the audio mixed, normalized, encoded and gated before hyperframes captures a frame, its failure returned before
   any frame, and muxed under the picture at the end (hyperframes' own sound no longer used for the finished mix).

## Context

Labels: `pkg: marketing-kit`. Follows #1031, #1079, #1085, #1095 (archived mix changes). No manifest or lockfile
change. No version bump here: the fix joins the next combined marketing-kit release (coordinator).

## Constraints

- The true peak limit is never relaxed.
- `mixLoudness: false` keeps the render's sound as it is (hyperframes' mix), as today.
- `finishFootage` keeps working on a render file alone (its tests and callers that pass no prepared mix).

## Notes

- Framing: skipped. The issue measures the failure on fixtures and names the fix's direction.

## Done

The footage mix stage solves the gain at a fixed ceiling on uncompressed passes, low-passes at 16 kHz to bound AAC's
overshoot, and moves the ceiling only by an encode's true peak excess; the issue's fixtures finish in at most two
encodes (master: up to 4 or a failure). `mixLoudness.attempts` and `mixLoudness.warnTolerance` (finishes with
`loudness.warning`) are new. The film's sound is mixed by ffmpeg, brought to the target and gated before hyperframes
renders a frame, and muxed under the picture at the end. Ships in the next combined marketing-kit release.
