# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/llm`. When an app has run a version
in production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

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
