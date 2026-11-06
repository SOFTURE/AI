# Research: a lossless, pre-gained speech chain (issue #1139)

## Where the lossy steps are

- `normalize.ts` `buildNormalizeArgs`: the clip's sound goes into `clips/<id>.mp4` as AAC 192k; the speech track was
  cut from that file (`TranscribeOutcome.speech[id] = clip.file`), so the first lossy generation runs at the source's
  quiet level (-40 LUFS in the issue's film).
- `render.ts` `buildAudioArgs` (`audio/<id>.mp3`, the providers' input), `buildSpeechArgs` (`speech.raw.mp3` or
  `speech.mp3`), `loudness.ts` `buildLoudnessArgs` (`speech.mp3`), `declick.ts` (MP3 when it is the last stage),
  `speech-ranges.ts` `buildRangeAudioArgs` (ranges cut to MP3 for the isolator) and `buildRangeLayArgs`
  (`audio/<id>.ranges.mp3`); `pipeline.ts` copies the cached isolated voice to `audio/<id>.isolated.mp3` for STT.
- `pipeline.ts` `getSpeechChainFiles` names the chain's files; `draft.ts` (thread #1143) uses it and
  `buildSpeechArgs` with its own output names.
- The final encodes: `loudness.ts` `buildMixArgs` (the mix's AAC, `FINISHED_AUDIO_BITRATE` 192k) and
  `publish.ts` `buildFinishArgs`.

## Findings

- hyperframes mixes the composition's `<audio>` elements through ffmpeg (PCM intermediates), so `assets/speech.wav`
  plays as `speech.mp3` did; the mix stage (`mix.m4a`) replaces the render's sound anyway.
- ElevenLabs' Voice Isolator and STT take WAV; the answer of the isolator is MP3 and is cached as such
  (`<key>.isolated.mp3`), which stays (the provider's bytes, and the cache key keeps paid work). The build folder gets
  it decoded to WAV.
- `loudnorm`'s first pass prints integrated loudness and true peak; a pre-gain of `min(-23 - I, -3 - TP)` dB keeps the
  peak at or under -3 dBFS (true peak ≥ sample peak). Measured after the same `aformat` to 48 kHz stereo the
  extraction uses, so a mono clip's up-mix is counted.
- `pcm_s24le` with the peak at -3 dBFS cannot clip and is what the providers accept widely; the internal chain after
  the cut (sums of segments, the declick, the loudness pass) is `pcm_f32le`, which never clips between stages.
- A b-roll clip's own sound sits under the speech at `ownVolume`; pre-gaining only the talking clips would move it by
  their gain. Non-talking clips take the mean of the talking clips' gains, so the relation stays.
- Cut ranges laid back over a pre-gained base: ranges cached before this change were cleaned from the un-gained
  sound; they still play (the final loudness pass sets the level), only a refused range next to them can step in level.
