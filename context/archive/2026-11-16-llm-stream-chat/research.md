# Research: llm-stream-chat

Builds on `context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md`. Checked here against the installed
`ai` 7.0.163 (`node_modules/ai/dist/index.d.ts`) and `ai@7.0.0` (packed), plus a scratch Vitest run of `streamText`
over `MockLanguageModelV4` + `simulateReadableStream` (deleted after the measurement).

## Callback behaviour of `streamText` (measured)

| Situation | Callbacks that fire | Notes |
| --- | --- | --- |
| normal answer | `onEnd` | `totalUsage`, `response.modelId` (the answered id), `finishReason`, `providerMetadata`, `steps` |
| provider throws before streaming | `onError` only | no `onEnd`, no `onAbort`; `text` rejects with `NoOutputGeneratedError` |
| provider `error` chunk mid-stream | `onError`, then `onEnd` | `onEnd` has `finishReason: "error"` and no token counts |
| `timeout` option elapses | `onAbort` | `reason` is a `DOMException` named `TimeoutError`; `steps` holds only finished steps |
| caller's `abortSignal` aborts (user pressed Stop) | `onAbort` | `reason` named `AbortError`; the unfinished step's tokens are not reported |
| `onEnd` throws | nothing | the SDK swallows it: the stream completes normally, `onError` is not called |

## Consequences for the design

- Exactly one record per call needs a "settled once" guard: an error can be followed by `onEnd`.
- Usage of an error or an abort is the sum of the finished steps (`onStepEnd`); the step cut short reports no tokens,
  so an abort mid-answer of a one-step chat has `usage: null`. Recorded as a limitation; the app decides whether a
  metering reservation is settled at its estimate or released (README recipe).
- A failing `onUsage` / `onCall` cannot propagate to a caller (the route has already returned the response) and the
  SDK would swallow it. It must still not be silent: the result carries a `recorded` promise that rejects with the
  hook's error, and the span records the exception.
- A user abort is not one of the four error codes. Records get the outcome `llm.aborted`; `LlmErrorCode` (the error
  type of `generateStructured` / `generateText`) is unchanged. `@softure-ai/metering`'s adapter does not read
  `outcome`, so the wider union does not affect it.
- `Prompt` is a union (`prompt` or `messages`), so the request type needs a distributive `Omit`.
- `ai@7.0.0` already has `onEnd`, `onAbort`, `onStepEnd`, `timeout` and `instructions`: the peer range stays `^7.0.0`.
