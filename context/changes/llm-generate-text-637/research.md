---
change_id: llm-generate-text-637
status: done
---

# Research: free-text generation in @softure-ai/llm (issue #637)

## Findings

- `foundation/llm/src/create-llm.ts`: `generateStructured` runs `callModel` (AI SDK `generateText` with
  `Output.object`, an `AbortController` raced against a timer, the call settled into a value first so a late rejection
  is never unhandled), then ends the span, awaits `onUsage` and returns a `Result`. `classifyFailure` maps
  `NoObjectGeneratedError` → `llm.invalid_output` (with usage), a `TimeoutError` → timeout, any `AISDKError` →
  `llm.unavailable`, and rethrows the rest.
- The request has no `maxOutputTokens`; the AI SDK's `generateText` accepts `maxOutputTokens` and its result carries
  `text`, `finishReason` (`"length"` on a token-limit stop), `response.modelId` and `totalUsage`.
  `NoObjectGeneratedError` carries `finishReason`, so a structured call cut by the limit can be told apart.
- `src/tracing.ts`: one constant `SPAN_NAME = "llm.generate_structured"` used by `startCallSpan`.
- `src/contract.ts`: `LLM_ERROR_CODES` (3 codes), `StructuredResult<T>`.
- `src/testing/index.ts`: `fakeModel` over `MockLanguageModelV4`; responses `output`, `text`, `unavailable`, `hang`;
  every answer has `finishReason: { unified: "stop" }`.
- Tests: `tests/generate-structured.test.ts`, `tests/tracing.test.ts`, `tests/fake-model.test.ts`,
  `tests/usage.test.ts`.

## Sources

`foundation/llm/src/*.ts`, `foundation/llm/tests/*.ts`, `foundation/llm/README.md`, the `ai@7` type declarations.
