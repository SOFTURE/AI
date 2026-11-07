---
change_id: marketing-kit-range-float-1193
status: done
---

# Plan: float range cuts for a float clip sound (issue #1193)

Input: change.md, research.md. Complexity: small.

## Phase 1: the fix

- `buildRangeAudioArgs(audio, range, output, options?: { peaks?: SpeechPeaks })`: a `.wav` output is `pcm_f32le`
  for `peaks: "float"`, `pcm_s24le` otherwise.
- `isolateSpeechRanges` passes `options.speechPeaks`.

## Phase 2: tests and docs

- Argument tests for both formats; an ffmpeg test that a range of a stereo float tone at 1.8 keeps its peak above
  1.0 (and that the 24-bit cut clips, documenting the cause); `isolateSpeechRanges` with `speechPeaks: "float"`
  hands the provider a `pcm_f32le` range.
- CHANGELOG and version 0.21.2 (the next marketing-kit release after 0.21.1).

## Acceptance

- A range of a sound above full scale reaches the provider unclipped.
- Gates: typecheck, lint, the marketing-kit tests.

## Decisions (auto)

- Keep float (the issue's first option) rather than a scale-and-undo gain: simpler, and the whole-clip path already
  sends float to the same provider.
- No downmix filter: the kit's ranges stay stereo, so there is no rematrix level shift to compensate.

## Progress

- [x] Phase 1
- [x] Phase 2
