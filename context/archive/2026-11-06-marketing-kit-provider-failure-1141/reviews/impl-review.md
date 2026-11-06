---
change_id: marketing-kit-provider-failure-1141
verdict: approved
---

# Implementation review (auto)

- Matches the plan: `ProviderFailure` in `voice/provider-failure.ts`, optional `providerFailure` on `TtsResult`, set
  by every failed ElevenLabs request; `isolateWithRetries` stops on `isRetryable: false`; the pipeline's provider
  failures become `{ kind: "provider" }`.
- The issue's "Done when": a fake answering 400 `audio_too_short` is asked once and its outcome carries status, code,
  request id and `isRetryable: false` (isolate-ranges test); a 503 is retried until bought.
- Safety: the key never enters the failure (asserted); `message` is truncated to 300 characters.
- `error` keeps its sentences (the existing assertions still match the same text).
- Evidence: `vitest run tools/marketing-kit` 1123 passed, 61 skipped; typecheck, ESLint on the changed files and the
  language gate clean. The full `npm run lint` runs out of memory in this container (known); CI runs it.
- Approved.
