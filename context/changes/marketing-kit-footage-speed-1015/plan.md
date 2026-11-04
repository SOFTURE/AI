---
change_id: marketing-kit-footage-speed-1015
status: in_progress
---

# Plan: faster footage normalize and cut preview (issue #1015)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: the normalize graph and the encoder options (TDD)

Files: `src/footage/normalize.ts` (+ test), `src/footage/pipeline.ts`, `src/index.ts`.

- `buildVideoFilter`: `[0:v]fps=30,<fit scale>,<tone map>,…`. Crop: `scale=W:H:force_original_aspect_ratio=increase,
  crop=W:H` before the tone map, then `setsar=1,format=yuv420p`. Blur: `scale=W:H:force_original_aspect_ratio=decrease:
  force_divisible_by=2` before the tone map, then `split` into the blurred background and the front as it is.
- `NormalizeEncoder = { preset?: X264Preset; threads?: number }`, `X264_PRESETS`; `NormalizeInput.encoder?`;
  `buildNormalizeArgs` uses `preset ?? "veryfast"`, adds `-filter_complex_threads N` and `-threads N` when set; a
  threads value that is not a positive integer throws (a programming error).
- `FootageRunOptions.normalize?: NormalizeEncoder`; `prepareFootage` passes it; `NORMALIZE_VERSION = 2`.
- Tests: scale before `format=gbrpf32le` for both fits and HDR kinds, `fps` first, SDR graphs, preset and threads args,
  invalid threads.

## Phase 2: the cut preview seek (TDD)

Files: `src/footage/render.ts` (+ test).

- `buildCutPreviewArgs`: per segment `-ss <start> -t <duration> -i <clip>`, graph `[i:v]setpts=PTS-STARTPTS,
  scale=540:-2,setsar=1`. Test pins the input arguments and the graph.

## Phase 3: docs

README (normalize section: order and the `normalize` option), CHANGELOG `## Unreleased`.

## Progress

- [ ] Phase 1: the normalize graph and the encoder options
- [ ] Phase 2: the cut preview seek
- [ ] Phase 3: docs
