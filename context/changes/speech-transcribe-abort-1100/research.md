# Research: transcribe abort signal (issue #1100)

## What exists

- `createTranscriber().transcribe(request)` normalizes the input with ffmpeg, then sends the chunks one by one to
  `provider.transcribeChunk` and stops at the first failure. `onUsage` runs once after any call that billed seconds,
  failures included, with `outcome: "ok" | SpeechErrorCode`.
- `openAiCompatibleProvider` calls `requestJson` from `@softure-ai/core`, which builds its own
  `AbortSignal.timeout(timeoutMs)` and takes no caller signal. The provider already wraps `fetch` to see that signal
  (to tell a timeout from a network failure); the same wrapper can combine it with a caller signal through
  `AbortSignal.any`, so `core` needs no change.
- `@softure-ai/jobs` gives a handler `context.signal`; the handler may return or throw after an abort, and the job is
  recorded `cancelled` (operator) or `stale` (shutdown, lost lease) either way.
- No other foundation package takes a caller signal yet, so there is no house convention to follow.

## Options

1. A new code `speech.aborted`, returned as a value like every other failure. `onUsage` records the billed seconds
   with `outcome: "speech.aborted"`.
2. Throw `signal.reason` (the `fetch` convention). No new code, but `onUsage` would need an outcome outside
   `SpeechErrorCode` for the seconds already billed, and the conventions return expected failures as values.

Recommendation: option 1.

## Risks

- An app that switches exhaustively over `SpeechErrorCode` gets a type error on upgrade: a minor (0.x) bump, named in
  the changelog.
- A chunk aborted in flight may still be billed by the provider; the transcriber cannot know, so it counts only the
  chunks the provider answered (as for any other failure mid-call).
- The ffmpeg decode is not interrupted: `CommandRunner` is public and takes no signal. The signal is checked right
  after it, before any upload; the decode is bounded by `maxDurationSeconds`.
