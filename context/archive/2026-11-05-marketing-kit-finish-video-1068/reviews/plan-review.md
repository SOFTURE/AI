---
change_id: marketing-kit-finish-video-1068
verdict: approved
---

# Plan review

- Covers every point of the issue's ask: option on both entry points (through the shared options type), exact
  arguments, rate cap, progress (already counted, research says why), fake tests and one ffmpeg test.
- Default behaviour untouched: `buildFinishArgs` without `video` keeps its current output; existing tests stay.
- Early validation keeps a typo from costing a music purchase. Good.
- Risk: `maxBitrate` parsing too strict for `"12.5M"`. The plan accepts a decimal number; keep it.
- Verdict: approved.
