# Research: clip-sound-one-sided-channel

## How sound flows today

- `pipeline.ts` `getClipSoundFiles` → `prepareClipSounds` (clip-sound.ts) writes `<build>/audio/<id>.wav` for every
  clip (talking and b-roll); `transcript.speech` maps clip ids to these files (or to the decoded isolated voice).
- `buildSpeechArgs` (render.ts), the draft (`draft.ts` `buildSpeechArgs` again) and the range lay
  (`speech-ranges.ts`) all read `transcript.speech`. The normalized clip's own AAC (`normalize.ts`) is only a
  fallback when a clip has no speech file.
- The isolated voice from the provider is mono (checked on a cached `.isolated.mp3`: 1 channel); mono goes to both
  channels already (`aformat` upmix copies it; `speech-ranges` pans mono to both).

## Measured

An adopting app's production files, `astats` per-channel RMS: source clip L -20.5 / R -116.6 dB; speech WAV L -23.6 /
R -119.6; draft L -15.0 / R -32.7 (music only on the right).

## ffmpeg facts (6.1)

- `astats=measure_overall=none:measure_perchannel=RMS_level` prints `Channel: N` and `RMS level dB: x` per channel;
  digital silence prints `-inf`.
- `aformat=...:channel_layouts=stereo` on a mono source copies it to both channels at the same level.

## Risks

- One more decode of each clip's sound (audio only, fast).
- A clip whose second channel is a genuinely quiet but live mic stays as it is (the -70 dB ceiling).
