# Implementation review: speech-transcribe-abort-1100

Verdict: approved.

- Every point of #1100 is covered with a test: an already aborted signal returns `speech.aborted` before normalizing
  (normalizer never called, nothing sent, no usage record); an abort during normalization returns before any upload
  and the temporary files are removed; an abort between chunks stops before the second chunk and reports the first
  chunk's 10 s with `outcome: "speech.aborted"`; the signal reaches every provider request, and a provider failure
  during an abort is reported as `speech.aborted`; no `signal` key reaches the provider when the request has none.
- Provider: a caller abort cancels the `fetch` in flight (the combined signal is aborted) and maps to `speech.aborted`;
  an already aborted signal sends nothing; the time limit still maps to `speech.timeout` with a live caller signal.
- `fakeTranscriber` answers an aborted signal with `speech.aborted` and records the call.
- `isAborted()` is a function because TypeScript keeps `aborted` narrowed to `false` across an await otherwise.
- Gates: typecheck, ESLint (speech) and the language gate green; the speech suite (61 tests) and the repository tests
  pass. No lockfile or version change: the CHANGELOG entry is under `## Unreleased` for the combined release.
