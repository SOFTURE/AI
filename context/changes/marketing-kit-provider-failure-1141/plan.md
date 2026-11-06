---
change_id: marketing-kit-provider-failure-1141
status: in_progress
---

# Plan: structured provider failures (issue #1141)

Input: change.md, research.md. Complexity: small.

## Phase 1: the type

- `voice/provider-failure.ts`: `ProviderFailure` (`kind`: `refused` | `rate_limited` | `unavailable` | `timeout` |
  `connection`; `status`, `code`, `message`, `requestId`, `isRetryable`), `readProviderFailure(response)` (status,
  provider code and message from the JSON `detail`, request id header, truncated message),
  `getConnectionFailure(error)` (`timeout` for a `TimeoutError`, else `connection`), `describeProviderFailure`.
  `isRetryable`: 5xx, 408, 429, timeout, connection.
- `TtsResult`'s failure side gets optional `providerFailure`.

## Phase 2: the providers and the callers

- `footage/elevenlabs.ts` `send`: every failure carries `providerFailure` (missing key: `refused`, code
  `missing_api_key`, not retryable). `error` keeps its sentence.
- `isolateWithRetries`: stops after a failure with `isRetryable: false`; the `failed` outcome carries
  `providerFailure` (null when the provider gave none).
- `FootageFailure` gets `{ kind: "provider"; provider: ProviderFailure }`; the pipeline's isolation, speech to
  text and music failures use it when the provider gave one. `isRetryableFootageFailure` follows `isRetryable`.
- `index.ts` exports the type and helpers.

## Phase 3: tests and docs

- elevenlabs tests: 400 `audio_too_short` with a request id answers the fields and `isRetryable: false`; 503, 429,
  408, connection and timeout are retryable; a missing key.
- isolate-ranges tests: a fake answering 400 `audio_too_short` is asked once and its outcome carries the failure;
  a 503 is retried.
- pipeline test: a provider refusal answers `{ kind: "provider" }`, not retryable.
- CHANGELOG `## Unreleased`, README footage section.

## Acceptance

- The issue's "Done when" holds in the kit's tests; gates: typecheck, lint, `npm test`.

## Decisions (auto)

- The field is `providerFailure`, not `failure`, so it never collides with `FootageError.failure`.
- Optional on `TtsResult`: a provider that gives none is treated as before (retryable, `process`).
- Body read failures after a 2xx (no words, no audio) stay without `providerFailure`: nothing structured to report.
- A new `provider` kind in `FootageFailure` (0.x minor; an exhaustive switch needs a case, noted in the CHANGELOG).

## Progress

- [x] Phase 1: `voice/provider-failure.ts`; `TtsResult` failure side has optional `providerFailure`.
- [x] Phase 2: ElevenLabs `send` sets it; `isolateWithRetries` stops on `isRetryable: false`; `FootageFailure` `provider` kind in the pipeline; exports.
- [x] Phase 3: tests in provider-failure, elevenlabs, isolate-ranges, failure, pipeline (58 passed; the new ones need fields master lacks); typecheck and ESLint clean. CHANGELOG, README.
