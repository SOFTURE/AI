---
change_id: marketing-kit-audio-probe-996
title: "marketing-kit: probe audio-only files (duration, codec) for music beds (issue #996)"
status: archived
roadmap_item: null
issue: 996
branch: claude/project-thread-x6qmua
created: 2026-11-03
updated: 2026-11-03
archived_at: 2026-11-03
---

## Intent

Close [issue #996](https://github.com/SOFTURE/AI/issues/996). The footage probe (`probeFile`, `readFootageProbe`)
answers `no video stream` for a music file, so an adopting app that lets the owner upload a music bed (mp3, m4a, wav)
cannot check it with the kit. After this change the kit offers:

1. `probeAudio(path, options)` answering `{ duration, codec, sampleRate, channels, bitRate }`, with a typed failure
   (`reason: "no-audio-stream"` and friends);
2. `checkMusicFileType({ fileName, contentType })` over one exported list of accepted music types, the same check
   the footage pipeline runs on a `music.file` before it probes it;
3. README docs on how the probed music feeds the render (looped or trimmed to the cut, ducked under the voice).

## Context

Labels: `enhancement`, `pkg: marketing-kit`. Files: `tools/marketing-kit/src/footage/probe.ts`, a new
`src/footage/audio.ts` with tests, `src/footage/pipeline.ts` (the music file step), `src/index.ts`, README, CHANGELOG.
PR #998 (#995, deploy keeps marketing-kit external in the worker bundle) touches only `tools/deploy` and the lockfile;
this change adds exports to the kit's root entry, which the external kit serves unchanged.

## Constraints

- No version bump (the coordinator releases in a batch); CHANGELOG `## Unreleased`.
- `probeFile` and `readFootageProbe` answer exactly as before.
- Generated music is out of scope (issue).
- English only; the adopting app is not changed.

## Notes

- Framing: skipped. The issue names the gap and a concrete API; the code confirms it (`readFootageProbe` requires a
  video stream, the pipeline only checks that a music file exists).
