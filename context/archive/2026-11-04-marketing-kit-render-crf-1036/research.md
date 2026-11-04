---
change_id: marketing-kit-render-crf-1036
---

# Research: an encoder CRF for the footage render (issue #1036)

## Confirmation (master 9da8f1d)

- `src/footage/pipeline.ts` `getHyperframesRenderArgs` builds `render --quality <tier> [--workers N]
  [--low-memory-mode | --no-low-memory-mode] -o <output>`; nothing sets the encoder's CRF.

## hyperframes 0.8.85 (`node_modules/hyperframes/dist/cli.js`)

- `ENCODER_PRESETS`: `draft` = libx264 `ultrafast` CRF 28, `standard` = `medium` CRF 18, `high` = `slow` CRF 15.
- `render --crf <n>`: "Override MP4/WebM encoder CRF"; a non-negative integer, mutually exclusive with
  `--video-bitrate`. The producer uses `job.config.crf ?? preset.quality` and validates `[0, 51]`.
- **No preset flag and no environment variable** sets the x264 preset apart from the tier (the `PRODUCER_*` list has
  only `PRODUCER_VP9_CPU_USED` for WebM). The issue's "ideally a preset independent of the tier" is not reachable
  without a hyperframes change; `quality: "draft"` plus `crf` is the fast route.
- `draft` changes one more thing: the screenshot capture's JPEG quality is 80 instead of 95
  (`captureOptions.quality`). The issue's measurement (`--quality draft --crf 18`, PSNR 44.3 dB, SSIM 0.99 against
  `medium` CRF 18) already includes it; the README must say so.

## Options

1. `crf?: number` on `RenderFootageOptions`, validated as an integer 0-51 like `workers`, passed as `--crf`.
   Recommended: the smallest change that meets the issue.
2. Also an x264 preset option: impossible through hyperframes' CLI today (see above).
