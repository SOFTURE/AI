---
change_id: marketing-kit-xfade-ffmpeg71-1057
verdict: approved
---

# Implementation review

Reviewed the diff of 825335b and f55c07e against plan.md.

- Phase 1: `fitStream` and every draft segment chain end `settb=1/30,fps=30`; the draft's `concat` join too, so
  every `xfade` input states its rate. `zoomFilters` scales the crop to `frame` (new required
  `PicturePieceArgsInput.frame`), `buildPicture` passes `getFrame(film)`, the frame the clips are normalized to.
- The new ffmpeg test (a picture piece fading from a 1.11 zoom on 1080x1920) failed first with "size 1078x1920"
  on the host's ffmpeg 6.1.1, then passed with 1080x1920 and the piece's frame count. The ffmpeg draft tests (every
  transition, captions) pass with the extra `fps`. `vitest run tools/marketing-kit`: 67 files, 1013 tests passed.
- Cause 1 is pinned by the graph tests only; ffmpeg 7.1 could not be installed in the container. The issue verified
  the same filters on 7.1.5.
- Phase 2: CHANGELOG `## Unreleased` names the new `frame` input for direct callers.

Verdict: approved, no changes.
