---
change_id: marketing-kit-range-float-1193
title: "marketing-kit: isolateSpeechRanges cuts a float clip sound's ranges as 32-bit float, unclipped (issue #1193)"
status: archived
roadmap_item: null
issue: 1193
branch: claude/project-thread-w2xgj3
created: 2026-11-07
updated: 2026-11-07
archived_at: 2026-11-07
---

## Intent

Close [#1193](https://github.com/SOFTURE/AI/issues/1193). With `speechPeaks: "float"` the clip sound is 32-bit float
and may peak above 0 dBFS; `buildRangeAudioArgs` cut every `.wav` range as `pcm_s24le`, clamping those peaks before
the isolator heard them. A float clip sound's ranges are cut as `pcm_f32le`, so the isolator gets the same sound the
whole-clip path sends.

## Context

Labels: `pkg: marketing-kit`. Rides the next marketing-kit release after 0.21.1 (#1194).

## Constraints

- The default (`speechPeaks: "ceiling"`) keeps 24-bit ranges exactly as before.
- No test talks to an external service.

## Notes

- Framing: skipped. The issue names the cause, the fix and the acceptance test.

## Done

`isolateSpeechRanges` cuts each range for the isolation provider in the clip sound's own format: 32-bit float with
`speechPeaks: "float"`, so a peak above full scale reaches the provider unclipped; 24-bit PCM otherwise, as before
(#1193). Next marketing-kit release.
