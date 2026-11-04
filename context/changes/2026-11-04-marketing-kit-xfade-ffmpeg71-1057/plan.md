---
change_id: marketing-kit-xfade-ffmpeg71-1057
status: open
---

# Plan: fades on ffmpeg 7.1 (issue #1057)

Input: change.md, research.md. Complexity: small (two graph builders, their tests, docs).

## Phase 1: the graphs (TDD)

Files: `tools/marketing-kit/src/footage/picture.ts`, `draft.ts`, `pipeline.ts`, their tests.

- Tests first: every stream into `xfade` ends `settb=1/30,fps=30` (draft segments, the draft's concat join, both
  picture streams); a zoomed tail scales to the given frame (`scale=1080:1920`); an ffmpeg run of a picture piece
  fading from a 1.11 zoom on 1080x1920 clips succeeds (it fails on 6.1 without the fix).
- `fitStream` and the draft chains end with `fps=30`; the concat join too. `PicturePieceArgsInput.frame` (required),
  `zoomFilters` scales to it; `buildPicture` passes `getFrame(film)`.

## Phase 2: docs

`tools/marketing-kit/CHANGELOG.md` `## Unreleased`: the fix, and `buildPicturePieceArgs` now takes `frame`.

## Decisions (auto)

- Option 1 from research. `frame` is required: a fade piece cannot be right without it, and the only caller is the
  kit's pipeline; a direct caller adds one field.
- No CI job on the worker recipe's ffmpeg 7.1 in this change: out of scope for the fix; the graph tests pin the
  `fps` the 7.1 failure needs.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1: the graphs
- [ ] Phase 2: CHANGELOG
- [ ] Implementation review
