---
change_id: speech-transcribe-abort-1100
status: archived
---

# Plan: transcribe abort signal (issue #1100)

Input: change.md, research.md. Complexity: small (two source files, the fake, tests, docs).

## Phase 1: abort support and tests (TDD)

Files: `foundation/speech/src/contract.ts`, `create-transcriber.ts`, `providers.ts`, `testing/index.ts`,
`tests/create-transcriber.test.ts`, `tests/providers.test.ts`, `tests/fake-transcriber.test.ts`.

- `SPEECH_ERROR_CODES` gains `speech.aborted` (documented).
- `TranscribeRequest.signal?: AbortSignal`; `ProviderChunk.signal?: AbortSignal`.
- `transcribe`: an already aborted signal returns `speech.aborted` before normalization (nothing uploaded, no usage
  record); checked again after normalization (temp files disposed) and before each chunk; passed to each provider
  request. A provider failure while the signal is aborted becomes `speech.aborted`. `onUsage` gets the billed seconds
  with `outcome: "speech.aborted"` when chunks were answered before the abort.
- `openAiCompatibleProvider`: the request's signal is `AbortSignal.any([timeout, chunk.signal])`; an abort by the
  caller maps to `speech.aborted`, by the time limit to `speech.timeout`.
- `fakeTranscriber`: an aborted `signal` answers `speech.aborted` (the call is still recorded).
- Tests: aborted before the call (normalizer never runs), abort between chunks (second chunk never sent, usage record
  with the first chunk's seconds and `speech.aborted`, temp files disposed), abort during a chunk request (provider
  sees the signal), provider maps a caller abort to `speech.aborted` and a timeout still to `speech.timeout`, fake.

## Phase 2: docs

README (signal on the request, the new code, jobs example), `CHANGELOG.md` under `## Unreleased`, the backlog line
ticked.

## Decisions (auto)

- Option 1 of research: a returned `speech.aborted` code, not a throw.
- No version bump here: the combined release bumps it (keeps `package-lock.json` untouched).
- The ffmpeg decode is not interrupted (public `CommandRunner` unchanged); the signal is checked right after it.

## Progress

- [x] Phase 1: abort support and tests (speech suite 61 passed)
- [x] Phase 2: docs
- [x] Implementation review
