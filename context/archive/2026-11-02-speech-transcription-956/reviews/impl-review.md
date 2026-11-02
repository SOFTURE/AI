---
change_id: speech-transcription-956
verdict: approved
---

# Implementation review

Reviewed the diff of 539cb10..HEAD against plan.md and the issue.

- Plan conformance: all four phases done as planned; the public API matches the plan (`createTranscriber`, the three
  adapters, `createFfmpegNormalizer`, `toSrt` / `toVtt` / `toParagraphs`, `SPEECH_ERROR_CODES`, `/testing`
  `fakeTranscriber`).
- Correctness: core files 400, 413 and 415 under `core.http_unexpected_answer` (with the status), not under
  `core.http_refused`; the mapping reads the status, and a test covers every status. A timed-out request and a network
  failure are both `core.http_unreachable`; the adapter tells them apart by the request's own abort signal, tested
  with a hanging fetch. An empty 2xx body is `speech.unavailable`.
- Resources: the temporary folder is removed on every path (normalizer failures, a thrown provider, success); tests
  assert the temp folder is empty afterwards. Chunks are cut from the PCM file by byte offset, so stitched timestamps
  are exact, and only one chunk is in memory at a time.
- Safety: ffmpeg is spawned without a shell, paths go in as `file:` arguments, and its output is discarded (it can
  quote paths). Keys never reach errors or records.
- Fixed during review: the missing-binary test made its folder with `mkdir` through `execFileSync`; it uses
  `mkdirSync` now.
- Follow-up, not needed for the issue: an abort signal on `transcribe` (a jobs `context.signal`) to stop between
  chunks. Recorded in the backlog.

Gates: typecheck, lint (ESLint + language), the package's 52 tests, the repository tests, build.

Verdict: approved.
