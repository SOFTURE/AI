---
change_id: marketing-kit-xfade-ffmpeg71-1057
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (8b1c891).

- Acceptance of #1057: both causes are covered (phase 1): `fps=30` on every `xfade` input in the draft and the
  picture, and a zoomed tail at the clip's frame. The ffmpeg test reproduces cause 2 on the host's 6.1.
- Cause 1 cannot run here (no ffmpeg 7.1); the graph tests pin the filter, and the issue verified the same graphs on
  7.1.5. Accepted.
- Risk: `fps=30` after `settb=1/30` on a stream already at 30 fps passes frames through; picture unchanged on 6.1.
- API: `buildPicturePieceArgs` gains a required `frame`; noted in CHANGELOG.

Verdict: approved, no changes.
