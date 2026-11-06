# Research: speech pre-gain on peaky material (issue #1181)

- `tools/marketing-kit/src/footage/clip-sound.ts`: `getPreGainDb` = `min(target - I, ceiling - TP)`; the clip sound is
  written as `pcm_s24le`, so a peak raised past 0 dBFS would clip there. `prepareClipSounds` answers `{ file, gainDb }`.
- Consumers: `isolate-ranges.ts` (`IsolatedSpeech.speechGainDb`, the range cut for the isolator writes `pcm_s24le`,
  the laid file uses `getAudioCodecArgs` = `pcm_f32le`) and `pipeline.ts` (`TranscribeOutcome.speechGainDb`, the
  whole clip sound goes to the isolator and the speech to text).
- Every later intermediate `.wav` is already 32-bit float (`getAudioCodecArgs`), and the film's loudness pass applies
  the final true-peak limit, so a float clip sound carries a peak above the ceiling safely to the end of the chain.
- The issue's numbers reproduce from the formula: -38.73 LUFS / -15.47 dBTP gets +12.47 dB and lands at -26.26 LUFS.
