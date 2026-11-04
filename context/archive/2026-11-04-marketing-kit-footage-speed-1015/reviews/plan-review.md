---
change_id: marketing-kit-footage-speed-1015
verdict: approved
---

# Plan review: marketing-kit-footage-speed-1015

- Covers the four proposals of #1015: the tone map on frame-sized pictures (going further than the issue by cropping
  first, measured), the per-segment seek, the `normalize` option, tests pinning both.
- Correctness: `fps` selects frames by timestamp, so moving it first keeps the same frames; the crop is a pixel
  selection, so cropping before the tone map keeps the same picture up to resampling; the seek gives identical frames
  (PSNR inf in research) because normalized clips carry a keyframe every half second and ffmpeg seeks accurately when
  transcoding.
- Cache: `NORMALIZE_VERSION` 2 re-normalizes old clips once, as the issue asks; the encoder options stay out of the
  stamp on purpose (a speed choice, not a different picture).
- Compatibility: new optional options and exports only.
- Overlap with #1016 and #1017: different functions; `index.ts`, README and CHANGELOG conflicts are additive.
- Approved without changes.
