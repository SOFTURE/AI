# Plan review: speech-transcribe-abort-1100

Verdict: approved.

- Every point of #1100 has a code change and a test: the request signal, the stops before normalization, between
  chunks and in flight, the usage record, the fake.
- A returned code matches the package (every failure is a value) and keeps `onUsage.outcome` inside
  `SpeechErrorCode`.
- Combining signals inside the provider's `fetch` wrapper keeps `@softure-ai/core` unchanged; `AbortSignal.any` is in
  Node 20.3+, and the package needs Node 22.
- A caller abort and a timeout stay apart: the timeout signal and the caller signal are checked separately.
- Risk accepted: the ffmpeg decode is not interrupted; bounded by `maxDurationSeconds`, and nothing is uploaded after
  an abort.
