# @softure-ai/llm

One way for an app to ask a language model for structured data or plain text: the app builds the model with any
[AI SDK](https://ai-sdk.dev) provider, and the package gives it

- `generateStructured`: the answer parsed and validated by a zod schema, a time limit, and a `Result` whose failures
  are stable codes;
- `generateText`: plain text (a summary, a Markdown rewrite, a short title) with the same limits, codes and records;
- a usage record per call (tokens, cost from the app's price table, outcome, the app's attributes such as an account
  id), for quotas and billing;
- an OpenTelemetry span per call;
- `fakeModel()` for tests, answering from a script.

The package has no provider layer, no environment variables and no `softure.config.ts` entry: the provider, its API
key and the model id stay in the app.

## Installation

```bash
npm install @softure-ai/llm ai zod
npm install @openrouter/ai-sdk-provider   # or @ai-sdk/openai, @ai-sdk/anthropic, …
```

`ai` (major 7) and `zod` (4) are peer dependencies: the app owns the AI SDK version its provider matches.

## Usage

```ts
// lib/llm.ts (server only)
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { createLlm } from "@softure-ai/llm";

const openrouter = createOpenRouter({ apiKey: process.env.OPENROUTER_API_KEY ?? "" });

export const llm = createLlm({
  model: openrouter(process.env.LLM_MODEL ?? "openai/gpt-5-mini"),
  pricing: { "openai/gpt-5-mini": { inputPerMillion: 0.25, outputPerMillion: 2, cachedInputPerMillion: 0.025 } },
  timeoutMs: 20_000,
  onUsage: (record) => recordUsage(record), // the app's own table or quota module
});
```

```ts
import { z } from "zod";
import { llm } from "@/lib/llm";

const verdictSchema = z.object({ score: z.number().int().min(1).max(5), reason: z.string() });

const result = await llm.generateStructured({
  schema: verdictSchema,
  system: "Rate the review from 1 to 5.",
  prompt: reviewText,
  attributes: { accountId: account.id },
});
if (!result.ok) return result; // "llm.unavailable" | "llm.invalid_output" | "llm.output_truncated" | "llm.timeout"
const { output, usage, model, costUsd } = result.value;
```

```ts
const summary = await llm.generateText({
  system: "Summarise the e-mail in two sentences.",
  prompt: mailBody,
  maxOutputTokens: 200,
  maxChars: 400,
  attributes: { accountId: account.id },
});
if (!summary.ok) return summary;
const { text, truncated } = summary.value;
```

### `createLlm(options)`

| Option | Default | Meaning |
| --- | --- | --- |
| `model` | required | an AI SDK model object (`LanguageModelV2`/`V3`/`V4`) from a provider; a bare model id string (the SDK's gateway) is not accepted |
| `pricing` | `{}` | model id → `{ inputPerMillion, outputPerMillion, cachedInputPerMillion? }` in USD; a model without an entry has `costUsd: null` |
| `onUsage` | none | `(record: UsageRecord) => void \| Promise<void>`, awaited after each call that reached the model and reported usage |
| `onCall` | none | `(record: LlmCallRecord) => void \| Promise<void>`, awaited after every finished call, failures and timeouts included, after `onUsage` |
| `timeoutMs` | `30000` | time limit of one call, provider retries included |
| `maxRetries` | the AI SDK's (2) | retries of a failed provider call inside the time limit |
| `clock` | `systemClock` | the `Clock` of `@softure-ai/core`, for `at`, `startedAt` and `durationMs` |
| `tracer` | global tracer `@softure-ai/llm` | an OpenTelemetry `Tracer` |

A timeout of 0 or less, a negative or fractional `maxRetries`, or a negative price throws a `RangeError` naming the
option.

### `generateStructured(request)`

| Field | Meaning |
| --- | --- |
| `schema` | zod schema of the answer; the model is asked for JSON and the answer is validated with it |
| `system` | optional system text |
| `prompt` | the user text |
| `maxOutputTokens` | upper limit of output tokens (a whole number of 1 or more); default: the provider's |
| `timeoutMs` | overrides the default time limit for this call |
| `model` | overrides the default model for this call (e.g. a cheaper one for a simple task) |
| `attributes` | `Record<string, string>` passed to `onUsage` and `onCall` as given; never written to spans |

Returns `Result<{ output, usage, model, costUsd, costSource }, LlmErrorCode>` (`ok` / `err` of `@softure-ai/core`).

### `generateText(request)`

Asks for plain text: no JSON envelope, so long Markdown is neither escaped nor cut inside a string. The fields of
`generateStructured` without `schema` (`system`, `prompt`, `maxOutputTokens`, `timeoutMs`, `model`, `attributes`), and

| Field | Meaning |
| --- | --- |
| `maxChars` | cuts the answer to at most this many characters (code points), at the last whitespace inside the limit, or hard when there is none; a whole number of 1 or more |

Returns `Result<{ text, truncated, usage, model, costUsd, costSource }, LlmErrorCode>`. `text` is the answer without surrounding
whitespace; `truncated` is `true` when `maxChars` cut it. An answer that is empty or only whitespace is
`llm.invalid_output`. Streaming is not offered.

A `maxChars`, `maxOutputTokens` or per-call `timeoutMs` that is out of range rejects with a `RangeError` naming the
call and the field, before the model is called.

## Error codes

| Code | When | Usage recorded |
| --- | --- | --- |
| `llm.unavailable` | the provider failed: an HTTP error, the network, a missing or wrong key, retries exhausted | no |
| `llm.invalid_output` | the model answered, but not with JSON matching the schema; for `generateText`, with an empty text | yes (the tokens were spent) |
| `llm.output_truncated` | the model stopped on the output token limit (`maxOutputTokens` or the provider's) before finishing | yes |
| `llm.timeout` | no answer within `timeoutMs`; the call is aborted | no |

`LLM_ERROR_CODES` lists them. An error that does not come from the AI SDK (a bug in the app's code or a provider) is
not mapped: it propagates, as does an error thrown by `onUsage` or `onCall`.

## Usage and cost

`UsageRecord` is `{ model, provider, usage, costUsd, costSource, outcome, durationMs, at, attributes }`, where `usage` is
`{ inputTokens, outputTokens, totalTokens, cachedInputTokens, reasoningTokens }`. A count the provider does not report
reads `0`. `outcome` is `"ok"` or the call's error code (`llm.invalid_output` and `llm.output_truncated`, the
failures that still record usage). `model` is the id the provider answered with, which is also the key `pricing` is read with.

Cost: when the provider reports what it billed, `costUsd` is that figure and `costSource` is `"provider"`, also for a
model `pricing` does not list. For OpenRouter the figure is `providerMetadata.openrouter.usage.cost` (OpenRouter's
fee) plus `usage.costDetails.upstreamInferenceCost` (what the model's provider charged a call on your own key, BYOK);
a part that is missing or not a non-negative number is skipped. A provider total of 0 counts as not reported when the
model has a price, so the price table decides; for a model without a price it stays `0` with `costSource:
"provider"` (a free model). Otherwise the price table gives
`(input − cached) × inputPerMillion + cached × (cachedInputPerMillion ?? inputPerMillion) + output × outputPerMillion`,
divided by one million, with `costSource: "price_table"`. Without either, `costUsd` and `costSource` are `null`. The
result of the call carries the same `costUsd` and `costSource` as the record. `getCostUsd(pricing, model, usage)` is
exported for estimates.

### A record of every call

`onUsage` sees only the calls that reported usage. For a ledger of every call (a cost screen, a spending limit, a
calls panel), pass `onCall`: it gets one `LlmCallRecord` per finished call, `llm.unavailable` and `llm.timeout`
included:

| Field | Meaning |
| --- | --- |
| `operation` | `"generateStructured"` or `"generateText"` |
| `model`, `provider` | the model id the provider answered with; without an answer, the requested one |
| `outcome` | `"ok"` or the call's error code |
| `usage` | as in `UsageRecord`; `null` when the provider reported none (`llm.unavailable`, `llm.timeout`) |
| `costUsd`, `costSource` | as in `UsageRecord`; `null` without usage |
| `startedAt`, `durationMs` | when the call started and how long it took, retries included |
| `attributes` | the call's `attributes` |

```ts
export const llm = createLlm({
  model: openrouter(process.env.LLM_MODEL ?? "openai/gpt-5-mini"),
  onCall: (record) => saveLlmCall(db, record), // flow and task come from attributes
});
```

An app that wrapped the model in an AI SDK middleware to read the provider's cost, and wrapped `generateStructured` /
`generateText` to see failed calls, drops both and reads `costUsd`, `costSource` and `outcome` from this record.

The package keeps nothing: storing records (a table, a counter per account, a monthly cap) is the app's or a quota
module's job, inside `onUsage`. To refuse a call over quota, check the quota before calling `generateStructured` or
`generateText`.

## Tracing

Every call is one span, `llm.generate_structured` or `llm.generate_text`, with `gen_ai.operation.name`, `gen_ai.provider.name`,
`gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`, `gen_ai.usage.output_tokens`,
`softure.llm.cost_usd`, `softure.llm.cost_source` and `softure.llm.outcome`; a failed call has status `ERROR` with its code. The prompt, the
answer and the call's attributes are never recorded (they may hold personal data). Without an OpenTelemetry SDK in
the process (e.g. `@softure-ai/observability`) the spans are no-ops.

## Testing

```ts
import { createLlm } from "@softure-ai/llm";
import { fakeModel } from "@softure-ai/llm/testing";

const model = fakeModel(
  { modelId: "fake-small" },
  { kind: "output", value: { score: 4, reason: "clear" } },
  { kind: "unavailable" },
);
const llm = createLlm({ model });
// call 1 → the object, call 2 and every later call → llm.unavailable
expect(model.doGenerateCalls).toHaveLength(0);
```

| Response | Effect |
| --- | --- |
| `{ kind: "output", value, usage?, providerMetadata? }` | answers with `value` as JSON |
| `{ kind: "text", text, usage?, providerMetadata? }` | answers with raw text: the answer of `generateText`, or not JSON → `llm.invalid_output` |
| `{ kind: "truncated", text?, usage?, providerMetadata? }` | stops on the output token limit after `text` → `llm.output_truncated` |
| `{ kind: "unavailable" }` | fails like a provider returning HTTP 503 → `llm.unavailable` |
| `{ kind: "hang" }` | never answers until aborted → `llm.timeout` (use fake timers) |

`usage` is `{ inputTokens, outputTokens, cachedInputTokens? }`, default 10 and 5. `providerMetadata` is what the
provider reports next to the answer, e.g. `{ openrouter: { usage: { cost: 0.0012 } } }` for a billed cost, or `{ openrouter: { usage: { cost: 0, costDetails: { upstreamInferenceCost: 0.0012 } } } }` for a BYOK call. Each call takes the next response;
the last one repeats. `model.doGenerateCalls` holds what was sent (prompt, response format, abort signal).

## Limitations

- Structured output and plain text only: no streaming or tools yet.
- AI SDK 7 only (`ai@^7`).
- No built-in price list: prices change often and differ per provider, so the app keeps them.
