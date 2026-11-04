---
change_id: marketing-kit-footage-speed-1015
status: done
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

- [x] Phase 1: the normalize graph and the encoder options (d350a1a)
- [x] Phase 2: the cut preview seek (02ec4e4)
- [x] Phase 3: docs (7bdf3aa)

## Verification

- `vitest run tools/marketing-kit/src/footage`: 18 files, 193 tests green.
- The kit's own builders run through real ffmpeg 6.1 on one core (`taskset -c 0`): `buildNormalizeArgs` of a 4 s
  3840x2160 HLG clip with `encoder: { threads: 1 }`, crop 18.2 s and blur 13.4 s (37.9 s and 39.5 s before), both
  120 frames of 1080x1920 BT.709; `buildCutPreviewArgs` of 20 segments from a 100 s clip 23.5 s (124.2 s before),
  1500 frames of 540x960.
- typecheck, ESLint and the language gate green in the pre-commit hook.
