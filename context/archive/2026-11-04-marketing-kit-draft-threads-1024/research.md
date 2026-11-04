---
change_id: marketing-kit-draft-threads-1024
---

# Research: ffmpeg threads in the footage draft (issue #1024)

## Current code

- `buildFootageDraftArgs` (`src/footage/draft.ts`) emits `-ss/-t/-i` per EDL segment, one `-filter_complex` graph and
  libx264 `veryfast`. No thread option anywhere: each decoder, the filter graph and x264 follow the host's cores.
- `buildNormalizeArgs` (`src/footage/normalize.ts`) already takes `encoder.threads`: a private `getThreadArgs` returns
  `-filter_complex_threads N` (before the inputs) and `-threads N` (before the output) and throws
  `normalize.threads must be a positive whole number, got X.` for a value that is not a positive integer.

## ffmpeg semantics

- `-threads N` placed before an `-i` is an input option: the decoder's thread count for that input. Placed before the
  output file it is the encoder's. `-filter_complex_threads N` is global and sizes the complex filter graph.
- So the draft needs `-threads N` before each segment's `-i` (20 segments = 20 decoders), plus the two the normalize
  step already uses. The speech input is an MP3 (single-threaded audio decoder) and needs none.

## Options

1. `threads?: number` on `RenderFootageDraftOptions` and `FootageDraftArgsInput`, sharing the normalize validation
   through a helper that names the option in its message (`draft.threads`). Chosen: the issue's first proposal, the
   smallest surface, and the draft has no preset to tune (it is fixed at `veryfast` CRF 28).
2. An `encoder` object like `NormalizeEncoder`: a preset knob nobody asked for. Rejected.

## Decisions (auto)

- Option 1. The error names `draft.threads`, so an app sees which option was wrong.
- The thread count is not passed to the speech track's ffmpeg run (an audio-only cut and MP3 encode).
