# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/llm`. When an app has run a version
in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## Unreleased

- **Embeddings**: `createEmbedder({ model, dimensions })` with `embedTexts({ values, attributes })`, over AI SDK
  `embedMany`: one vector per text, batches by the model's limit, the time limit, `llm.unavailable` / `llm.timeout`, and
  `llm.invalid_output` when a vector has another length than `dimensions`; usage and cost records (`onCall`
  `operation: "embedTexts"`) and a span `llm.embed_texts`.
- Two embedding models without a provider package: `workersAiEmbeddingModel({ binding, model })` (Cloudflare Workers
  AI through the Worker's binding) and `openAiCompatibleEmbeddingModel({ baseUrl, model, apiKey? })` (any `/embeddings`
  endpoint).
- `fakeEmbeddingModel({ dimensions })` and `embedWords` in `@softure-ai/llm/testing`: deterministic word vectors.
- Types: `LlmCallRecord.operation` adds `"embedTexts"`. Migrate: code that switches exhaustively over it adds the case.

## 0.3.0

- `streamChat` (#1258): a streamed chat answer over AI SDK `streamText` that returns its `StreamTextResult` (a route
  calls `toUIMessageStreamResponse()`), with the client's model, `timeoutMs`, `attributes`, `onUsage`, `onCall`,
  pricing, provider cost and a span `llm.stream_chat`. One record per chat with the usage and cost of all steps;
  `llm.aborted` when the request's `abortSignal` stops it, with the usage of the finished steps. `recorded` on the
  result settles after the hooks and rejects with a hook's error.
- `fakeChatModel()` in `@softure-ai/llm/testing`: a streaming fake (`text`, `tool-call`, `truncated`, `unavailable`,
  `error`, `hang`).
- Types: `UsageRecord.outcome` and `LlmCallRecord.outcome` are now `LlmOutcome` (`"ok" | LlmErrorCode |
  "llm.aborted"`), and `LlmCallRecord.operation` adds `"streamChat"`. Migrate: code that switches exhaustively over
  either adds the new case; a route that called AI SDK `streamText` directly and priced it with `getCostUsd` moves to
  `streamChat` and drops its own usage conversion.

## 0.2.3

- `@opentelemetry/sdk-trace` ~3.1.0 (was ~3.0.0), the line `@softure-ai/observability` uses.

## 0.2.2

- Docs: the README points to `createLlmUsageRecorder` of `@softure-ai/metering` for a spend ledger on `onUsage`.

## 0.2.1

- The provider's cost of a BYOK call (#857): for OpenRouter `costUsd` is now `usage.cost` plus
  `usage.costDetails.upstreamInferenceCost`, so a call on the account's own provider key (OpenRouter's fee 0, the
  model's charge in the upstream cost) records what the model's provider billed instead of 0.
- A provider total of 0 no longer hides the price table (#857): a model `pricing` lists gets the price table's
  estimate with `costSource: "price_table"`; a model without a price keeps `costUsd: 0, costSource: "provider"`.
- Migrate: an app that read the provider's cost in its own model middleware and computed the estimate with
  `getCostUsd` because `UsageRecord.costUsd` was 0 drops that middleware and takes `costUsd` and `costSource` from
  `onUsage` / `onCall` (or the call's result) again. Records written before the upgrade with `costUsd: 0,
  costSource: "provider"` for a priced model stay as they were; recompute them from the stored tokens if a budget
  needs them.

## 0.2.0

- The provider's billed cost (#805): when the provider reports what it billed (OpenRouter's
  `providerMetadata.openrouter.usage.cost`), `costUsd` is that figure, also for a model `pricing` does not list. A new
  `costSource` (`"provider"` | `"price_table"` | `null`) on `UsageRecord` and on both results says where `costUsd`
  came from; the span gets `softure.llm.cost_source`. Without a provider figure the values are as before.
- `onCall` (#805): an optional hook awaited after every finished call, `llm.unavailable` and `llm.timeout` included,
  with an `LlmCallRecord { operation, model, provider, outcome, usage, costUsd, costSource, startedAt, durationMs,
  attributes }` (`usage` is `null` when the provider reported none). It runs after `onUsage`; a throw propagates, as
  from `onUsage`. Migrate: an app that wraps the model with `wrapLanguageModel` to read the provider's cost and joins it
  to `onUsage` through `AsyncLocalStorage`, and wraps `generateStructured` / `generateText` to record failed calls,
  drops both and writes its ledger from `onCall`.
- `fakeModel`: `providerMetadata` on `output`, `text` and `truncated` responses.

## 0.1.2

- `generateText({ system, prompt, maxOutputTokens, maxChars, timeoutMs, model, attributes })` (#637): plain text for
  summaries, Markdown rewrites and short titles, with the same time limit, error codes, usage record, cost and span
  (`llm.generate_text`) as `generateStructured`. Returns `{ text, truncated, usage, model, costUsd }`; the text is
  trimmed and `maxChars` cuts it at the last whitespace inside the limit. An empty answer is `llm.invalid_output`.
- New error code `llm.output_truncated`: the model stopped on the output token limit. Both calls return it and record
  the usage; a structured answer cut by the limit used to be `llm.invalid_output`. An app that switches exhaustively
  over `LlmErrorCode` gets a type error until it handles the new code.
- `maxOutputTokens` on both calls; an out-of-range value rejects with a `RangeError`.
- `fakeModel`: `{ kind: "truncated", text?, usage? }` stops on the token limit; `{ kind: "text" }` answers
  `generateText`.

## 0.1.1

- README: `UsageRecord.outcome` is documented (`"ok"` or the call's error code). No code change; the release
  also confirms publishing through the package's npm trusted publisher.

## 0.1.0

- First version (#472): `createLlm({ model, pricing, onUsage, timeoutMs, maxRetries })` over an AI SDK 7 model the
  app builds, `generateStructured({ schema, system, prompt })` returning a `Result` with the zod-validated output, the
  token usage and the cost, or `llm.unavailable` / `llm.invalid_output` / `llm.timeout`; an `onUsage` record per call
  for quotas and billing; an OpenTelemetry span per call; `fakeModel()` from `@softure-ai/llm/testing`.
