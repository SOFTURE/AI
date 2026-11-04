---
change_id: marketing-kit-mix-loudness-1031
---

# Research: the final mix's loudness and the ducking timing (issue #1031)

## Findings

- `renderFootage` (`src/footage/pipeline.ts`) normalizes `assets/speech.mp3` with `normalizeLoudness`
  (`src/footage/loudness.ts`), then writes the ducked music track, then lets hyperframes mix both. `finishFootage`
  probes the render and runs `buildFinishArgs` (`src/footage/publish.ts`), which copies a publishable AAC 48 kHz stereo
  track or re-encodes it; the mix is never measured.
- `duckingKeyframes(words, { volume, duckedVolume, attack?, release?, gap? })` already defaults attack 0.25 s and
  release 0.5 s; `renderFootage` passes only `volume` and `duckedVolume`. `FootageMusic` and the `music` schema have
  no timing fields.
- Measured in the container (ffmpeg 6): a 6 s H.264 + AAC fixture with a quiet tone and noise at -43 LUFS, measured
  with `loudnorm=...:print_format=json` on the MP4 (`-vn`), then finished with `-c:v copy` and
  `-af loudnorm=...:measured_*:linear=true,aresample=48000 -c:a aac -b:a 192k`, came out at -14.1 LUFS, true peak
  -7.0 dBTP; a pulsed fixture came out at -14.0 LUFS. The video stream stays copied.
- `buildLoudnessMeasureArgs` has no `-vn`: on an MP4 it would decode the whole picture for nothing. Adding `-vn` is
  harmless for the speech mp3.
- When the linear gain would push the true peak past the target, `loudnorm` falls back to its dynamic mode, which
  holds the true peak; the integrated target is still met.

## Options

1. Measure the render in `finishFootage` and pass a `loudnorm` audio filter to `buildFinishArgs` (one encode of the
   audio, video copied). Reuses the speech track's measurement and filter code.
2. Normalize the mixed audio into a separate file and mux it back: one more file and pass for the same outcome.

Recommendation: option 1.
