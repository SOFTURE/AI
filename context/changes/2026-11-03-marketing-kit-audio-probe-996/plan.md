---
change_id: marketing-kit-audio-probe-996
status: in_progress
---

# Plan: probe audio-only files for music beds (issue #996)

Input: change.md, research.md (option 1). Complexity: small (one new module, one pipeline line, docs).

## Phase 1: the audio probe and the type check (TDD)

Files: `tools/marketing-kit/src/footage/probe.ts`, `src/footage/audio.ts`, `src/footage/audio.test.ts`,
`src/index.ts`.

- `probe.ts`: extract `runFfprobe(path, options)` → `{ ok: true; json } | { ok: false; error }` from `probeFile`
  (same messages); `probeFile` uses it.
- `audio.ts`:
  - `MUSIC_FILE_TYPES`: extension → accepted content types (research.md);
  - `checkMusicFileType({ fileName?, contentType? })` → `{ ok: true; extension; contentType }` or
    `{ ok: false; error }`; at least one input required; both checked when both given (the content type must belong
    to the extension's list);
  - `AudioProbe { duration, codec, sampleRate, channels, bitRate: number | null }`;
  - `readAudioProbe(json)` → `{ ok: true; probe } | { ok: false; reason: AudioProbeFailure; error }`, reasons
    `no-audio-stream`, `no-duration`, `unexpected-output`; the first audio stream wins, video (cover art) ignored;
  - `probeAudio(path, { signal })`: `runFfprobe` + `readAudioProbe`, reason `unreadable` when ffprobe fails;
  - `describeAudioProbe(probe)` one log line.
- Tests: stereo mp3, cover art ignored, no audio stream, missing duration, stream duration fallback, bit rate from
  format, unexpected shape; type check by extension, by content type with parameters and case, mismatch, unknown,
  neither given; `probeAudio` on a real sine wav and a silent video when `ffprobe` is on PATH (skipped otherwise).

## Phase 2: the pipeline gate

Files: `src/footage/pipeline.ts`.

- `prepareFootage`, right after the clips are probed and before anything is normalized or paid for: for a `file`
  source, the type check on the path, then `probeAudio`; a failure ends the run with `music: <error>`; success logs
  `describeAudioProbe`. Same in placeholder runs (the file still plays). `getMusic` keeps its existence check.

## Phase 3: docs

README (the footage Music bullet and the blocks list): the probe, the type list, how a bed fits the cut (looped or
trimmed by `buildMusicArgs`, ducked by `duckingKeyframes`, `volume` / `duckedVolume`), an upload example. CHANGELOG
`## Unreleased`, noting the new gate on `music.file`.

## Decisions (auto)

- A separate audio probe, not a `kind` on `probeFootage` (research.md).
- The pipeline gates a `music.file` with the same type check and probe the app uses, so a file the app accepted is
  one the render accepts (issue ask 2). A file with an unlisted extension now stops the run with a clear message;
  the CHANGELOG says so.
- `.mp4` is not a music type: the issue names audio files; an mp4 bed can be remuxed to `.m4a` without re-encoding.
- The gate sits in `prepareFootage`, not `getMusic`: `getMusic` runs after the transcripts were bought, and the
  footage probe's rule is "every problem before anything is paid for".
- `bitRate` is `null` when ffprobe reports none (Opus, FLAC), not omitted: a stable shape for storing with the asset.

## Progress

- [x] Phase 1: the audio probe and the type check (2b9b677)
- [ ] Phase 2: the pipeline gate
- [ ] Phase 3: docs
