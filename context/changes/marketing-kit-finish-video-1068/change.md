---
change_id: marketing-kit-finish-video-1068
title: "marketing-kit: the final pass can re-encode the picture to H.264 High at a chosen preset and CRF (issue #1068)"
status: in_progress
roadmap_item: null
issue: 1068
branch: claude/project-thread-0ou4cg
created: 2026-11-05
updated: 2026-11-05
---

## Intent

Close [issue #1068](https://github.com/SOFTURE/AI/issues/1068): a `quality: "draft"` render is Constrained Baseline
at about 21 Mbit/s and the final pass copies it as it is. An app wants H.264 High at a controlled size (roughly
10-12 Mbit/s) without paying for hyperframes' `standard` tier.

## Context

Labels: pkg: marketing-kit (found in an adopting app). Follows #1051 (the copy of a Constrained Baseline picture) and
#1036 (`crf`). No version bump: the coordinator releases.

## Scope

- `finishVideo?: { preset: X264Preset; crf: number; maxBitrate?: string }` on `RenderFootageOptions` (so also
  `renderFootageFilm`).
- `buildFinishArgs` takes it: `-c:v libx264 -profile:v high -pix_fmt yuv420p -preset <p> -crf <n>`, plus
  `-maxrate`/`-bufsize` when `maxBitrate` is set; sound, loudness pass, fast start and cover unchanged.
- Invalid values end the run with a sentence before anything is bought or built.
- Tests on the arguments; one ffmpeg test that an `ultrafast` (draft) render with the option ends High yuv420p.
- CHANGELOG `## Unreleased`, README "Encoder speed".

## Constraints

- Without the option nothing changes.
- No change to an app's repository.

## Notes

- Framing: skipped. The issue states the problem, the measure, the option's shape and the acceptance.
