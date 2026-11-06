---
change_id: marketing-kit-range-gain-1159
---

# Research: cached ranges after the speech pre-gain (issue #1159)

- `prepareClipSounds` (`footage/clip-sound.ts`) answers `{ file, gainDb }` per clip; `isolateSpeechRanges`
  (`footage/isolate-ranges.ts`) uses only `file` (`getSound`), both to cut a bought range and as the base the
  cleaned windows are laid over (`buildRangeLayArgs`, `footage/speech-ranges.ts`).
- A range's cache key (`getSpeechRangeCache`) is the clip identity, the range and the provider: the input's gain is
  not in it, so a range bought before 0.16.0 (from the un-gained sound) is served as it is.
- Ranges bought with 0.16.0 before this fix are pre-gained but carry no record of it. So a missing record cannot mean
  "un-gained": the level has to be read from the audio.
- A cleaned voice differs from its input by a couple of dB (noise removed); a pre-gain on a quiet phone clip is
  around +17 dB. The difference between the cached window and the same range of the pre-gained base tells the two
  apart when it sits nearer to `-gainDb` than to 0.
- `transcribeFootage` answers `speech` paths only (`TranscribeOutcome`); the gains are dropped in
  `getClipSoundFiles` (`footage/pipeline.ts`).
- `loudness.ts` has `readLoudnessMeasurement` and `isSilent` for a `loudnorm` measuring pass.
