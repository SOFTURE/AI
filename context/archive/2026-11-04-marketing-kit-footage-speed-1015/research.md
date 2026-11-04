---
change_id: marketing-kit-footage-speed-1015
---

# Research: footage normalize and cut preview speed (issue #1015)

## Confirmation (master 2532cbd)

- `src/footage/normalize.ts` `buildVideoFilter`: `[0:v]<tone map at source size>,fps=30,<cover or blur>`. The tone map
  (`zscale` to linear, `format=gbrpf32le`, `tonemap`, `zscale` back) runs on the source's full-size float frames and
  on every source frame, even when the source is 60 fps and only 30 are kept.
- `src/footage/render.ts` `buildCutPreviewArgs`: every segment is `-i <clip>` and `trim=start:end`, so each segment
  decodes its clip from 0 up to its start.
- `buildSpeechArgs` does the same with `atrim` on audio only.

## Measurements (ffmpeg 6.1.1, `taskset -c 0`, this container)

Normalize of a 4 s 3840x2160 HLG HEVC 10-bit clip into the 1080x1920 frame (decode alone 5.4 s):

| Fit | Before | Scale to the frame first | PSNR new vs old |
| --- | --- | --- | --- |
| crop | 37.9 s | 18.1 s (cover + crop, then tone map) | 44.9 dB |
| blur | 39.5 s | 12.4 s (fit inside, then tone map, the blurred copy from it) | 38.9 dB |

Scaling only to the cover size before the tone map (keeping the crop after it) gave 30.1 s for crop: a landscape
source's cover of a vertical frame is 3413x1920, almost the source's pixels. Cropping before the tone map is the win,
and the crop is a pixel selection, so the order does not change what is kept.

Cut preview of 20 segments of 2.5 s from one 100 s 1080x1920 normalized clip (keyframe every 15 frames):

| Args | Time | Output |
| --- | --- | --- |
| `trim` per input (today) | 124.2 s | 1500 frames, 50.0 s |
| `-ss <start> -t <duration> -i` per input, `setpts=PTS-STARTPTS` | 23.2 s | 1500 frames, 50.0 s, PSNR inf (identical) |

Speech track with `atrim` from 0 for the same 20 segments: 1.7 s. Audio decoding is cheap, so `buildSpeechArgs` stays
as it is.

## Options

1. Reorder the graph: `fps` first (fewer frames through every stage), then the frame-sized scale (crop: cover and
   crop; blur: fit inside), then the tone map; the blur's background is made from the fitted picture. One graph for
   SDR and HDR. Chosen.
2. Scale inside the first `zscale` (`w`/`h` expressions): `zscale` has no `force_original_aspect_ratio`, the cover
   expression is longer and harder to test, and the crop would still run after the tone map. Rejected.

## Decisions (auto)

- `fps=30` moves to the front for every clip: it selects the same frames by timestamp whatever follows, and halves the
  work for a 60 fps phone clip.
- The fitted picture of the blur fit is rounded to even sizes (`force_divisible_by=2`): `zscale` needs even sizes
  for 4:2:0.
- The blur's background is scaled from the fitted picture (at least 1080 wide), not from the source: it is blurred and
  darkened, the difference is invisible, and it skips one more source-size scale.
- `buildSpeechArgs` keeps `atrim` (1.7 s for 20 segments; the issue says "if it helps").
- `normalize.preset` takes x264's preset names (default `veryfast`); `normalize.threads` sets `-threads` (encoder) and
  `-filter_complex_threads` (filters); neither joins the normalize stamp, so changing them does not re-normalize
  clips already made.
