---
change_id: marketing-kit-provider-failure-1141
status: done
---

# Research

- Footage providers (`footage/providers.ts`) return `TtsResult<T>` from `voice/provider.ts`
  (`{ ok: false; error: string }`). The ElevenLabs implementation (`footage/elevenlabs.ts`) builds every failure in
  `send` (missing key, connection, non-2xx with the first 300 bytes of the body) and in the body readers (no words,
  not JSON, no audio).
- ElevenLabs error bodies are JSON `{ "detail": { "status" | "code", "message", "request_id"? } }` or
  `{ "detail": "<text>" }`; the response carries a `request-id` header (some edges `x-request-id`).
- The one retry loop is `isolateWithRetries` in `footage/isolate-ranges.ts` (#1127): every refusal is asked again,
  and a range's `failed` outcome carries only `error`. `voice/batch.ts` stops at the first failure (no retry).
- The pipeline (`pipeline.ts`) wraps provider failures for whole-clip isolation, speech to text and music into
  `FootageFailure` `{ kind: "process" }` (#1126), which `isRetryableFootageFailure` calls retryable, also for a 400.
