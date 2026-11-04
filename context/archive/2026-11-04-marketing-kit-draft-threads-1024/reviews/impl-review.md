---
change_id: marketing-kit-draft-threads-1024
verdict: approved
---

# Implementation review: marketing-kit-draft-threads-1024

Reviewed 734ca3f..e508087 against plan.md and the two asks of #1024.

- Ask 1: `FootageDraftArgsInput.threads` and `RenderFootageDraftOptions.threads` reach `buildFootageDraftArgs`, which
  puts `-filter_complex_threads N` before the inputs, `-threads N` before each segment's `-ss` (an input option, so it
  sizes that segment's decoder) and `-threads N` before the output file (the encoder). The speech input gets none, as
  decided in research. Without the option the arguments are exactly as before.
- Ask 2: the validation is the shared `getThreadArgs`, now naming the option: `draft.threads must be a positive whole
  number, got X.`; the normalize message is unchanged and its tests still pass.
- Measured with real ffmpeg: `threads: 1` on 4 visible cores matches the single-core memory (433 MB against 1119 MB)
  and frame count.
- No breaking change: optional options only; `getThreadArgs` is not exported from the package index.
- Approved.
