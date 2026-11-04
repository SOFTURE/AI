---
change_id: marketing-kit-footage-speed-1015
verdict: approved
---

# Implementation review: marketing-kit-footage-speed-1015

Reviewed 5a63a10..7bdf3aa against plan.md and the four proposals of #1015.

- Proposal 1: `buildVideoFilter` runs `fps=30`, then the frame-sized scale (crop: cover and crop; blur: fit inside,
  even sizes), then the tone map; the blur's background is made from the fitted picture and the front is the fitted
  picture itself. SDR crop graphs are unchanged; `NORMALIZE_VERSION` is 2, so old clips are made once more.
- Proposal 2: `buildCutPreviewArgs` passes `-ss`/`-t` per input and no `trim`; real ffmpeg gives the same 1500 frames
  (research: PSNR inf against the old args). `buildSpeechArgs` is left as it is (1.7 s measured), as recorded.
- Proposal 3: `FootageRunOptions.normalize` reaches `buildNormalizeArgs` as `encoder`; `-filter_complex_threads`
  goes before the inputs and `-threads` before the output; an invalid thread count throws with the value. Not in
  the stamp, on purpose.
- Proposal 4: tests pin the order (`fps` first, scale before `format=gbrpf32le` for every HDR kind and fit), the
  blur graph, the encoder arguments and the per-segment seek arguments.
- No breaking change: optional options and new exports only; CHANGELOG `## Unreleased`.
- Approved.
