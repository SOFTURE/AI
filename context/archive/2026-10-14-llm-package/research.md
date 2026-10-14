# Research: llm-package

Question: what does a thin, provider-agnostic wrapper over the AI SDK need, and how does the current SDK behave on the
failures the package must map to codes?

## AI SDK 7 (`ai@7.0.x`, current major since 2026-06-25)

- `generateObject` is gone; structured output is `generateText({ model, output: Output.object({ schema }), system,
  prompt })`, returning `result.output`, `result.usage` / `result.totalUsage` (`LanguageModelUsage`:
  `inputTokens`, `outputTokens`, `totalTokens`, `inputTokenDetails.cacheReadTokens`,
  `outputTokenDetails.reasoningTokens`, each `number | undefined`) and `result.response.modelId`.
- `model` accepts `LanguageModel` = a gateway id string or a `LanguageModelV2 | V3 | V4` object; providers
  (`@openrouter/ai-sdk-provider`, `@ai-sdk/openai`, …) build the objects. `model.provider` and `model.modelId` are
  plain strings on the object.
- `abortSignal` and `timeout` both exist; an aborted call rejects with the signal's reason (`DOMException`
  `TimeoutError` for `AbortSignal.timeout`). `maxRetries` defaults to 2.
- `ai/test` exports `MockLanguageModelV4({ modelId, doGenerate })`; it imports only `@ai-sdk/provider-utils` (no test
  runner), so it can back a published `testing` entry.

### Measured (probe with `MockLanguageModelV4`, zod 4, `maxRetries: 0`)

| Model returns | `generateText` |
| --- | --- |
| `{"score":3}` for `z.object({ score: z.number() })` | `output = { score: 3 }`, `usage.inputTokens = 10`, `response.modelId = "m1"` |
| `nope` (not JSON) | throws `NoObjectGeneratedError` (cause `JSONParseError`), `error.usage.totalTokens = 15` |
| `{"score":"x"}` | throws `NoObjectGeneratedError` (cause `TypeValidationError`), usage present |
| throws `APICallError` 503 | rethrown as `APICallError` (`APICallError.isInstance`) |
| never resolves, aborted by `abortSignal` or `timeout` | throws `DOMException` named `TimeoutError` |

So: `NoObjectGeneratedError.isInstance` → invalid output (tokens were spent, usage is known); abort by the package's
own timer → timeout; any other `AISDKError` (API call, retry exhausted, missing key, no content) → unavailable;
anything else is a programming error and propagates.

## Repository

- `Result`, `ok`, `err`, `ErrorCode` and `Clock` come from `@softure-ai/core` (`foundation/core/src/result.ts`).
- No package emits spans yet; `@softure-ai/observability` starts the SDK and offers a logger only. `@opentelemetry/api`
  ^1.9.1 is in the lockfile; a tracer from it is a no-op when the app starts no SDK.
- Package shape: `tests/repo/packages.test.ts` (exports `@softure-ai/source` → types → default, CHANGELOG, tsc build);
  `foundation/` packages need no `module.json` or twelve README sections.
- `ai` is not in the lockfile. The newest 7.x is from today; 7.0.122 (2026-09-28) is two weeks old and becomes the
  dev dependency, the peer range is `^7.0.0`.
