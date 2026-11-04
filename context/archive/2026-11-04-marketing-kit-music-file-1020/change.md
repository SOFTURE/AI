---
change_id: marketing-kit-music-file-1020
title: "marketing-kit: accept a music file stored without an extension, and a video with sound as a bed (issue #1020)"
status: archived
roadmap_item: null
issue: 1020
branch: claude/project-thread-aoc2d1
created: 2026-11-04
updated: 2026-11-04
archived_at: 2026-11-04
---

## Intent

Close [issue #1020](https://github.com/SOFTURE/AI/issues/1020). Since 0.5.0 (#996) `prepareFootage` checks a
`music.source.kind === "file"` with `checkMusicFileType({ fileName: path })`, which looks only at the extension. An
adopting app stores uploads through `@softure-ai/files` under extensionless keys (`<hex2>/<hex2>/<uuid>`), so every
stored music file is refused before it is probed. A clip's own sound (`.mp4` / `.mov` with an audio stream) worked as
a bed in 0.4.0 and is refused now. After this change:

1. the film's file source carries optional `fileName` and `contentType` (from the stored file), used by the type check;
2. with neither given and no extension on the path, the type check is skipped and `probeAudio` decides;
3. a video file with an audio stream is an accepted bed: the music track already reads only its audio;
4. tests cover an extensionless `.m4a` and an extensionless `.mp4` with sound.

## Context

Labels: `bug`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/film.ts`, `audio.ts`, `pipeline.ts`,
`render.test.ts`, README, CHANGELOG. Open PRs #1017 and #1019 touch `pipeline.ts` and `render.ts` in other
functions; master is merged in before the merge.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- English only; the adopting app is not changed.
- `marketing.json` keeps `music.file` as a path (a file in the repo always has a name).

## Notes

- Framing: skipped. The issue names the regression, its cause in the code and concrete asks.
