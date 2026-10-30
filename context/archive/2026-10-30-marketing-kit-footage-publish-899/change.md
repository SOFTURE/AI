---
change_id: marketing-kit-footage-publish-899
title: "marketing-kit: publishable footage output (issue #899)"
status: archived
roadmap_item: null
issue: 899
branch: claude/project-thread-22trpl
created: 2026-10-30
updated: 2026-10-30
archived_at: 2026-10-30
---

## Intent

Close [issue #899](https://github.com/SOFTURE/AI/issues/899): the footage film is not ready to hand to a scheduler or
a platform. Normalize the speech track's loudness (two-pass `loudnorm`, default −14 LUFS / −1 dBTP) before the music
is mixed under it, give the film a final pass (H.264 High, yuv420p, AAC 48 kHz stereo, `+faststart`, stream copy
where possible) checked with ffprobe, write a cover JPG, and return the written file's facts
(`bytes`, `width`, `height`, `durationSeconds`, `cover`).

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Builds on #897 (merged 01cf45f). #898 follows and touches the same
files; one batched marketing-kit release follows all of them (coordinator's brief), so no version bump here.

## Constraints

- Unit tests need no ffmpeg: argument builders and parsers are pure; the fixture render covers the real run.
- `FootageFilm` gains optional fields only, so apps that build it by hand keep compiling.
- The screen film's render path stays as it is.

## Notes

- Framing: skipped. The issue names each gap and its fix.
