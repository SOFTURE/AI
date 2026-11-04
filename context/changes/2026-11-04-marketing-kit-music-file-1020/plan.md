---
change_id: marketing-kit-music-file-1020
status: in_progress
---

# Plan: music files without an extension, video beds (issue #1020)

Input: change.md, research.md (option 1). Complexity: small.

## Phase 1: the type check and the source (TDD)

Files: `src/footage/film.ts`, `src/footage/audio.ts`, `src/footage/audio.test.ts`.

- `MusicSource` file branch: `{ kind: "file"; path: string; fileName?: string; contentType?: string }`, documented
  as the stored file's original name and content type.
- `checkMusicFileType`: a name without an extension counts as no name (so a content type alone decides).
- `MUSIC_FILE_TYPES` gains video containers whose sound can be a bed: `.mp4` (`video/mp4`, `audio/mp4`), `.m4v`
  (`video/x-m4v`, `video/mp4`), `.mov` (`video/quicktime`), `.webm` (`video/webm`, `audio/webm`).
- Tests: extensionless name + content type accepted; extensionless name alone refused (nothing to check); `.mp4`
  and `.mov` accepted with and without their content types.

## Phase 2: the pipeline

Files: `src/footage/pipeline.ts`, `src/footage/pipeline.test.ts`.

- `checkMusicFile(source)`: with `fileName` or `contentType` on the source, the type check uses them; else with an
  extension on the path, the path; else the check is skipped (logged) and `probeAudio` decides.
- Tests (real ffmpeg, like the existing ones): an extensionless `.m4a` goes on; an extensionless `.mp4` with sound
  goes on; an extensionless file with no audio still stops with `no audio stream`; a declared `fileName` of an
  unlisted type stops; an `.mkv` path stops by type; `buildMusicArgs` renders the music track from an `.mp4` with sound.

## Phase 3: docs

README (music file source fields, accepted types, the upload example), CHANGELOG `## Unreleased`.

## Decisions (auto)

- Video files with an audio stream are accepted beds (issue ask 3, as in 0.4.0); no extraction step (research option 2
  rejected: the music track already reads only the audio of a video bed).
- The video types join the one shared list, so an app's upload check and the run agree (the point of #996).
- An extensionless path with no declared name or type skips only the type check; the probe still requires an audio
  stream and a duration, which is the precise reason the type check stood in for.
- `marketing.json` gets no `fileName` / `contentType`: a repo file always has a path the kit can read.

## Progress

- [ ] Phase 1: the type check and the source
- [ ] Phase 2: the pipeline
- [ ] Phase 3: docs
