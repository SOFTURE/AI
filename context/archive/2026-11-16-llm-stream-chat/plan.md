# Plan: llm-stream-chat

## Approach

`createLlm(...).streamChat(request)` wraps AI SDK `streamText` and returns its `StreamTextResult` with one extra
property, `recorded: Promise<void>`. The request is `streamText`'s options without `model` / `timeout`, plus
`model?`, `timeoutMs?`, `attributes?`. The wrapper sets the model and `timeout` (per-call, then client, then 30 000),
starts a span `llm.stream_chat`, tracks finished steps through `onStepEnd`, and settles exactly once:

- `onEnd`: usage from `totalUsage`, model from `response.modelId`, provider cost summed over the steps; outcome `ok`,
  or `llm.output_truncated` on `finishReason: "length"`.
- `onError`: `llm.unavailable`, usage of the finished steps (or none).
- `onAbort`: `llm.timeout` for a `TimeoutError` reason, else `llm.aborted`; usage of the finished steps.

Settling runs `onUsage` (when there is usage), then `onCall` (`operation: "streamChat"`), ends the span, then the
caller's own callback of the same name. A hook failure rejects `recorded` (pre-handled, so an unawaited one is never
an unhandled rejection) and is recorded on the span. Records' `outcome` widens to `LlmOutcome = "ok" | LlmErrorCode |
"llm.aborted"`.

`@softure-ai/llm/testing` gets `fakeChatModel(...responses)` on `MockLanguageModelV4` + `simulateReadableStream`:
`text`, `tool-call`, `truncated`, `unavailable` (throws before streaming), `error` (error chunk after text), `hang`
(streams text, then waits for the abort); `usage` and `providerMetadata` per response; `doStreamCalls` to inspect.

## Phases

1. Code and tests (test-first for the record contract): `tests/stream-chat.test.ts` covers the streamed text and the
   record of an answer (usage, price-table and provider cost, answered model, attributes), a multi-step tool answer
   (total usage, cost summed over steps), truncation, a provider failure before and during the stream, a timeout, a
   user abort after a finished step (usage of that step) and before any (usage `null`), exactly one record per call,
   the caller's `onEnd` / `onAbort` / `onError` still called, a failing hook rejecting `recorded`, the span's name and
   attributes, `RangeError` for a bad `timeoutMs` / `maxOutputTokens`; `tests/fake-chat-model.test.ts` covers the fake.
2. Docs: README (`streamChat` section, chat route recipe with body limit, `validateUIMessages`, authorization, rate
   limit and metering reservation; drop "Streaming is not offered"; limitations), CHANGELOG `## Unreleased`, package
   description.

Done when: `npm run typecheck`, `npm run lint`, the llm tests and the repository tests pass.

## Progress

- [x] 1 Code and tests (16 streamChat and 7 fakeChatModel tests; llm suite 91 passed; 324e21f)
- [x] 2 Docs (README streamChat section, chat route and budget recipes, CHANGELOG Unreleased)

## Decisions (auto)

- Name `streamChat` (the issue's), not `streamText`: it says what the route does and does not shadow the SDK's name.
- `recorded` on the result instead of a different return shape: the issue asks for the `StreamTextResult`, and the
  route still needs a way to learn that a hook failed (Next.js `after(() => stream.recorded)`).
- `llm.aborted` only in records, not in `LlmErrorCode`: the non-streaming calls never abort on the user's word.
- Default time limit is the same as the other calls (30 000), for one rule; long chats pass `timeoutMs`.
