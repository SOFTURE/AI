---
change_id: marketing-kit-finish-video-1068
---

# Research: finishVideo (issue #1068)

## Where the final pass lives

- `tools/marketing-kit/src/footage/publish.ts` `buildFinishArgs(input, facts, output, { audioFilter })`: copies the
  picture when `isPublishableVideo` (H.264 Constrained Baseline, Main or High, yuv420p), else re-encodes it at
  `medium` CRF 18 High.
- `tools/marketing-kit/src/footage/pipeline.ts` `finishFootage(film, input, options)`: probes the render, measures
  the mix, calls `buildFinishArgs`, runs ffmpeg with `onSeconds` progress, checks `findFinishProblems`, logs
  `finish: <streams> to H.264 <profile>, ...`, writes the cover. Called from `runRenderFootage` with the
  `RenderFootageOptions`; `RenderFootageFilmOptions` extends them, so one option covers both entry points.
- `X264Preset` and `X264_PRESETS` already exist in `normalize.ts` and are exported from the package.
- `getHyperframesRenderArgs` validates `crf` (whole number 0..51) by throwing; it runs after the paid music step.

## Progress

`runFfmpeg` passes `-progress` and reports encoded seconds through `onSeconds`, so the stage's bar already follows
whatever the pass does; a re-encode simply reports slower. Nothing to change beyond passing the option.

## Rate cap

`-maxrate` needs `-bufsize` with libx264. Twice the cap is the common VBV buffer (about two seconds at the cap). The
cap is an ffmpeg rate string (`"12M"`, `"12000k"`); a number with an optional `k`/`M` suffix is accepted, the buffer
written as twice the number with the same suffix.

## Measure

The issue's own: `veryfast` High CRF 20 re-encode of an `ultrafast` file costs about 1.8 s per footage second on one
CPU, a quarter of `medium`.
