---
change_id: marketing-kit-xfade-ffmpeg71-1057
---

# Research

- `tools/marketing-kit/src/footage/draft.ts` `buildFootageDraftArgs`: each segment chain ends
  `…,setpts=PTS-STARTPTS,settb=1/30`; the `concat` join ends `concat=n=2:v=1:a=0,settb=1/30`. Both feed `xfade`.
- `tools/marketing-kit/src/footage/picture.ts` `fitStream` ends `setpts=PTS-STARTPTS,settb=1/30`; both inputs of a
  fade piece's `xfade` come from it. `zoomFilters` scales the cropped tail by `iw*S:ih*S`.
- Reproduced cause 2 on the container's ffmpeg 6.1.1: a 1080x1920 clip, `crop=iw/1.11…,scale=iw*1.11:ih*1.11`,
  `xfade` refuses "size 1078x1920"; with `scale=1080:1920` it renders. Cause 1 needs ffmpeg 7.1 (not installable
  here); the issue reports `fps=30` after `settb` fixes it on 7.1.5, and on 6.1 `fps` on a 30 fps stream is a no-op.
- The normalized clips are at the film's frame (`getFrame(film)` in `pipeline.ts`, passed to `normalizeFootage`), so
  the tail's target size is that frame. `buildPicture` in `pipeline.ts` is the only caller of `buildPicturePieceArgs`;
  it has `film`.
- Tests: `picture.test.ts` and `draft.test.ts` pin the graphs; `draft.test.ts` also runs ffmpeg on generated clips.

## Options

1. The issue's fix: `fps=30` after every `settb=1/30` that feeds `xfade`; the tail scaled to the clip's frame, passed
   to `buildPicturePieceArgs` as a new `frame` input.
2. `scale2ref` against the incoming stream: no new input, but deprecated in ffmpeg 7.

Recommendation: option 1.
