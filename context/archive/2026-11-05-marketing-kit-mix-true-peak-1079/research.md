---
change_id: marketing-kit-mix-true-peak-1079
---

# Research

## Where the mix is finished

`finishFootage` (`tools/marketing-kit/src/footage/pipeline.ts`) measures the render with `measureLoudness`
(`loudnorm print_format=json`), builds `getLoudnessFilter` (`loudnorm ... linear=true,aresample=48000`) and passes it
as `audioFilter` to `buildFinishArgs` (`publish.ts`), which encodes AAC 192k 48 kHz in the same ffmpeg run as the
picture copy. The output is never measured; the log line prints the targets.

## Measured (ffmpeg 6.1.1 in the container, the issue's fixture)

- `loudnorm` linear, written as PCM: -1.0 dBTP; the same encoded AAC: -0.3 dBTP. The overshoot comes from the codec.
- `alimiter` at 192 kHz (4x oversampling of 48 kHz) holds the ceiling on PCM (-1 -> -0.9, -2 -> -1.9) but the AAC
  overshoot after it is erratic: ceiling -1 -> -0.3, -1.5 -> 0.0, -2 -> -0.9, -2.5 -> -1.7 dBTP. A pre-codec lowpass
  does not make it predictable. Only measuring the encoded audio and lowering the ceiling works.
- A 3x3 grid (speech 0.05-0.6, music 0.2-0.95): gain (`target - measured`) + limiter at `truePeak - 1 dB`, AAC,
  measure, then ceiling lowered by the overshoot + 0.3 dB and the gain corrected by the integrated miss: every case
  lands <= -1 dBTP and -14 +/- 1 LUFS within 1-3 encodes (worst: +0.89 -> -3.51 dBTP at the second try).
- Gain plus limiter instead of `loudnorm`: `loudnorm` falls back to its dynamic mode when the gain would break `TP`,
  which drifts the integrated loudness (the issue saw -15.5 LUFS). A plain `volume` gain is deterministic and the
  limiter alone holds the peak; it is also the "gain plus limiter" stage the issue asks for when the speech was
  normalized before the mix.
- `alimiter` options in 6.1: `limit` (linear, 0.0625-1, i.e. down to -24 dB), `level` (auto level, default on: must be
  off), `latency` (delay compensation, keeps the audio in sync with the picture), `attack` 5 ms, `release` 50 ms.
- `loudnorm`'s measurement (`input_i`, `input_tp`) upsamples to 192 kHz, so its `input_tp` is a true peak; it matches
  `ebur128=peak=true` to 0.1 dB on every encode above. The existing `measureLoudness` is reused for the gate.

## Options

1. Keep `loudnorm` and add a limiter after it in the final pass, no measurement: fails (AAC overshoot is erratic).
2. Separate audio pass: gain + oversampled limiter -> AAC `.m4a`, measure, bounded retries, mux with `-c:a copy`,
   measure the finished MP4 and gate. Seconds of extra work; the picture untouched.

Option 2 is recommended (the issue's own route).
