---
change_id: marketing-kit-render-memory-1030
status: in_progress
---

# Plan: renderFootage memory on a small worker (issue #1030)

Input: change.md, research.md (options 1 and 3). Complexity: medium.

## Phase 1: the picture in film time (TDD)

Files: `src/footage/picture.ts` (new), `src/footage/picture.test.ts`.

- `planFootagePicture(film, edl)`: per segment, its film frames (`round(start × 30)` to the next segment's), its
  clip and media start, and for a `fade` cut the outgoing segment's tail (clip, media start = its end, frames, held
  zoom = its end scale). Reuses `planFootageDraft` for fades and scales.
- `buildPicturePieceArgs(piece, clips, output, encoder)`: one ffmpeg, the incoming clip (and the outgoing tail for
  a fade, cropped to its zoom about 50 % 42 %, `xfade` at offset 0), `tpad` so a short clip holds its last frame,
  exactly `frames` frames, no audio; x264 with the normalize encoder's preset and threads, CRF 18, keyframe every
  half second, BT.709 tags.
- `buildPictureConcatArgs(list, output)`: the concat demuxer, stream copy, fast start.
- Tests: frame counts sum to the cut's frames; a fade piece's inputs, crop and `xfade`; a plain piece has one input;
  encoder preset and threads; a missing clip throws.

## Phase 2: one `<video>` in the composition and the render options (TDD)

Files: `src/footage/{compose,pipeline}.ts`, `src/index.ts`, tests.

- `FootageComposeAssets.picture?: string`: with it, one `<video id="picture">` over the whole cut; each segment's
  scale is `tl.set` at its start, Ken Burns a tween on `#picture`; no opacity tweens (fades are in the picture).
  Without it the composition is as before.
- `renderFootage` builds the picture in the `assets` stage (track `picture`, pieces one after the other, removed
  after the join) and composes with it.
- `RenderFootageOptions.workers?: number` and `lowMemory?: boolean` become hyperframes' `--workers` and
  `--low-memory-mode` / `--no-low-memory-mode` (`getHyperframesRenderArgs`, exported for tests).
- Tests: the picture composition (one video, sets and tweens, no fades), render arguments.

## Phase 3: docs and a real render

README (footage render memory: the table, time cost, the options), CHANGELOG `## Unreleased`, Dockerfile comment.
Render the fixture footage film (`MARKETING_KIT_RENDER=1`) and the 45 s measurement film again with the new path.

## Progress

- [ ] Phase 1: the picture in film time
- [ ] Phase 2: one `<video>` and the render options
- [ ] Phase 3: docs and a real render

## Decisions (auto)

- Option 1 over 2: only one `<video>` brings the capture under 1.2 GB; 2 fixes extraction only.
- The picture is built by the kit, not by a single ffmpeg over every segment: one decoder at a time keeps the
  extra step at about 110 MB.
- The normalize encoder settings (`normalize.preset`, `normalize.threads`) also encode the picture: one knob for
  the kit's intermediate files.
- The per-segment composition stays for callers of `composeFootage` without `picture` (public API).
