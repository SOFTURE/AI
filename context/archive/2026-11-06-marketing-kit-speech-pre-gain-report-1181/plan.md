---
change_id: marketing-kit-speech-pre-gain-report-1181
status: archived
---

# Plan: report the speech pre-gain, and an opt-in float sound (issue #1181)

Input: change.md, research.md. Complexity: small.

## Phase 1: the outcome as a union

- `clip-sound.ts`: `SpeechPreGain` = `{ kind: "on_target" } | { kind: "held_by_peak_ceiling" } |
  { kind: "peaks_over_ceiling" }` (each with `inputLufs`, `inputTruePeakDbtp`, `reachedLufs`, `truePeakDbtp`) |
  `{ kind: "silent" }` | `{ kind: "shared" }` (a non-talking clip gained by the talking clips' mean).
  `getSpeechPreGain(measurement, { peaks })` answers `{ gainDb, preGain }`; `getPreGainDb` stays as its gain.
  `ClipSound.preGain`. `prepareClipSounds(…, { log, peaks })` logs one line per clip held by the ceiling or with
  peaks over it.

## Phase 2: the opt-in float sound

- `SpeechPeaks = "ceiling" | "float"` (default `ceiling`). `float`: the gain goes to the target, every clip sound is
  written as 32-bit float WAV, so a peak above the ceiling cannot clip; the outcome says `peaks_over_ceiling`.
- `FootageRunOptions.speechPeaks` and `IsolateSpeechRangesOptions.speechPeaks` pass it on; `TranscribeOutcome`
  (`ready`) and `IsolatedSpeech` answer `speechPreGain` by clip id.

## Phase 3: tests and docs

- Unit: each kind from a measurement (the issue's numbers), the float codec in the args.
- Real ffmpeg: the issue's peaky clip (speech-like tone plus three 1 ms peaks) is `held_by_peak_ceiling` and lands
  near the reported `reachedLufs`; with `float` it lands within 0.5 LU of -23, its peaks intact (true peak above
  the ceiling, sample peak matching input + gain), and the envelope is the input's scaled by one gain.
- isolate-ranges / pipeline: the outcome carries `speechPreGain`.
- CHANGELOG `## Unreleased`, README section.

## Acceptance

- Gates: typecheck, lint, `npm test` (marketing-kit), language gate.

## Decisions (auto)

- Float WAV rather than a peak-only repair: it touches no sample, so the speech envelope is exactly the input's
  scaled by one gain; the final loudness pass already owns the film's true-peak limit.
- The range cut for the isolator stays 24-bit: a peak above 0 dBFS is cut there only, in what the provider hears
  (the issue's "leave the ceiling to the isolator's input cut"); the speech track keeps it.
- `float` stays opt-in: it changes the gain of clips cached before, which the #1159 gain records already correct.

## Progress

- [x] Phase 1: `getSpeechPreGain`, `describeSpeechPreGain`, `ClipSound.preGain`, log line.
- [x] Phase 2: `speechPeaks` through `FootageRunOptions` and `IsolateSpeechRangesOptions`; `speechPreGain` outcomes.
- [x] Phase 3: `npx vitest run tools/marketing-kit` green (real ffmpeg 6.1.1: held clip lands at its reported
  `reachedLufs` within 0.5 LU; float clip within 0.5 LU of -23 LUFS, true peak above -3 dBTP, `pcm_f32le`, and equal
  to the held sound raised by the gains' difference to under -60 dB); typecheck and ESLint clean.
