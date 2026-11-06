---
change_id: marketing-kit-lossless-speech-1139
status: in_progress
---

# Plan: a lossless, pre-gained speech chain (issue #1139)

Input: change.md, research.md. Complexity: medium (one new module, five touched, their tests, docs).

## Phase 1: the clip's sound, lossless and pre-gained

Files: `src/footage/clip-sound.ts` (new), `src/footage/clip-sound.test.ts`.

- `SPEECH_PRE_GAIN = { target: -23, peakCeiling: -3 }`. `buildClipSoundMeasureArgs` (seek and length as
  `buildNormalizeArgs`, `aformat` 48 kHz stereo, `loudnorm` print), `getPreGainDb(measurement)` (`min(target - I,
  ceiling - TP)`, 0 for silence), `buildClipSoundArgs` (same seek and length, `volume`, `pcm_s24le` WAV; silence from
  `anullsrc` for a clip without sound).
- `prepareClipSounds(clips, { buildDir, signal })`: talking clips measured and gained; other clips the mean of the
  talking clips' gains; writes `audio/<id>.wav`, answers `{ file, gainDb }` per clip.
- `getAudioCodecArgs(output)`: `.wav` PCM float, `.flac` FLAC, else MP3 (kept for an app's own names).
- Tests through ffmpeg: a -40 LUFS tone lands at -23 ± 0.5 LUFS; a loud one is capped at -3 dBFS peak; the WAV's length
  equals the trimmed clip's.

## Phase 2: the chain

Files: `pipeline.ts`, `render.ts`, `loudness.ts`, `speech-ranges.ts`, `isolate-ranges.ts`, `declick.ts`, tests.

- `transcribeFootage` (placeholder too): speech map from `prepareClipSounds`; the isolator and STT get the WAV; the
  cached isolated voice decoded to `audio/<id>.isolated.wav` and used as the clip's speech.
- `isolateSpeechRanges`: base and range inputs from the clip's WAV; ranges cut to WAV, laid to `<id>.ranges.wav`.
- `buildSpeechArgs`, `buildLoudnessArgs`, `buildRangeLayArgs`, `buildAudioArgs`, declick: codec by the output's
  extension; `getSpeechChainFiles` names `speech.raw.wav`, `speech.declicked.wav`, `speech.wav`; composition plays
  `assets/speech.wav`.
- `MixLoudnessTarget.audioBitrateKbps` (192 to 512, default 192) and the schema; `buildMixArgs` takes it.
- Test: a rendered placeholder film's build folder has no `.mp3` speech file.

## Phase 3: acceptance and docs

- A quiet-fixture check (speech at -40 LUFS plus a noise floor): the pause noise (5th-percentile RMS) and the tone's
  purity of the rendered speech track are no worse than `loudnorm` straight from the clip; the mix verdict passes.
- README (speech chain, pre-gain, bitrate option), CHANGELOG `## Unreleased`.

## Decisions (auto)

- Pre-gain measured on the trimmed clip's sound, true peak capped at -3 dBTP (stricter than -3 dBFS sample peak).
- Non-talking clips take the mean gain of the talking clips (0 dB when there are none), so a b-roll's own sound keeps
  its relation to the speech.
- Cache keys unchanged: no paid call is repeated; earlier cleaned voices are reused.
- The provider-facing WAVs are `pcm_s24le`; the internal chain is `pcm_f32le`.
- The bitrate option lives on `mixLoudness` (the stage that encodes the finished sound); a film without a mix stage
  keeps 192k.

## Progress

- [x] Phase 1: `clip-sound.ts` and its tests (pure args, -40 LUFS to -23, the peak cap, trimmed length, b-roll mean gain)
- [x] Phase 2: transcribe, isolate-ranges, render, loudness, declick on WAV; `audioBitrateKbps`; transcribe test asserts no MP3 in `audio/`
- [x] Phase 3: acceptance check in `clip-sound.test.ts` (pause noise and tone residual within 0.5 dB of a lossless loudnorm, sample difference under -40 dB; the same check with MP3 encodes measures -1.4 dB and fails); README, CHANGELOG
