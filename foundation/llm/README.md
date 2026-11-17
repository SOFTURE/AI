# @softure-ai/llm

One way for an app to ask a language model for structured data or plain text: the app builds the model with any
[AI SDK](https://ai-sdk.dev) provider, and the package gives it

- `generateStructured`: the answer parsed and validated by a zod schema, a time limit, and a `Result` whose failures
  are stable codes;
- `generateText`: plain text (a summary, a Markdown rewrite, a short title) with the same limits, codes and records;
- `streamChat`: a streamed chat answer (AI SDK `streamText`, tools and steps included) for an AI SDK UI `useChat`
  route, with the same model, time limit, records, cost and spans;
- a usage record per call (tokens, cost from the app's price table, outcome, the app's attributes such as an account
  id), for quotas and billing;
- an OpenTelemetry span per call;
- `fakeModel()` and `fakeChatModel()` for tests, answering from a script.

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

For a spend ledger with budgets, `createLlmUsageRecorder` of `@softure-ai/metering` is a ready `onUsage`
([metering README](../../modules/metering/README.md), section 10).

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
`llm.invalid_output`. For a streamed answer, see `streamChat`.

A `maxChars`, `maxOutputTokens` or per-call `timeoutMs` that is out of range rejects with a `RangeError` naming the
call and the field, before the model is called.

### `streamChat(request)`

Streams a chat answer through AI SDK [`streamText`](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text) and
returns its `StreamTextResult`, so a route answers with `toUIMessageStreamResponse()`. The request is `streamText`'s
own options (`messages` or `prompt`, `instructions`, `tools`, `stopWhen`, `maxOutputTokens`, `abortSignal`,
`onEnd`, ...) without `model`, `timeout` and `streamRetries`, plus:

| Field | Meaning |
| --- | --- |
| `model` | overrides the client's model for this chat |
| `timeoutMs` | time limit of the whole answer, every step included; default the client's `timeoutMs` (30 000). A chat with long answers or tools sets a longer one |
| `attributes` | passed to `onUsage` and `onCall` as given; never written to spans |

The chat is recorded once, when the answer is over: one `onUsage` (when a model call reported usage) and one `onCall`
with `operation: "streamChat"`, the usage and cost of all steps together (the provider's billed cost summed over the
steps, else the price table on the total tokens), and the model id the provider answered with:

| How it ended | `outcome` | `usage` |
| --- | --- | --- |
| the answer finished | `ok` | all steps |
| the model stopped on the output token limit | `llm.output_truncated` | all steps |
| the provider failed, before or during the stream | `llm.unavailable` | the steps that finished before the failure, else `null` |
| `timeoutMs` elapsed | `llm.timeout` | the finished steps, else `null` |
| the request's `abortSignal` aborted (the user pressed Stop) | `llm.aborted` | the finished steps, else `null` |

The AI SDK reports no tokens for a step that was cut short, so an answer stopped half way records only the steps
before it: `usage: null` for a one-step chat. The provider still billed the part it streamed; see the metering recipe
below for what to do with a reservation. The request's own `onEnd`, `onStepEnd`, `onAbort` and `onError` are still
called, after the records.

The result carries `recorded: Promise<void>`. It resolves once `onUsage` and `onCall` ran and rejects with the error
either of them threw; the span records that error too. The response has left by then, so a hook's failure cannot
reach the route: hand `recorded` to the platform's after-response hook (Next.js `after`), which reports it. The answer
ends, and `recorded` settles, only once the stream is read, which `toUIMessageStreamResponse()` does.

A `timeoutMs` or `maxOutputTokens` out of range throws a `RangeError` naming the field, before the model is called.

#### A chat route

```ts
// app/api/chat/route.ts
import { after } from "next/server";
import { consumeRateLimit } from "@softure-ai/security/server";
import { convertToModelMessages, isStepCount, safeValidateUIMessages } from "ai";
import { z } from "zod";
import { llm } from "@/lib/llm";
import { chatTools, type ChatMessage } from "@/lib/chat-tools";

const MAX_BODY_BYTES = 64_000;
const bodySchema = z.object({ messages: z.array(z.unknown()).min(1).max(40) });

export async function POST(request: Request): Promise<Response> {
  const session = await requireSession(request); // the app's authorization: 401 without a session
  const limit = await consumeRateLimit(securityCtx, { bucket: "chat", key: session.userId }); // @softure-ai/security
  if (!limit.ok) return Response.json({ error: "chat.rate_limited" }, { status: 429 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return Response.json({ error: "chat.too_large" }, { status: 413 });
  const body = bodySchema.safeParse(parseJson(raw)); // JSON.parse that returns undefined on bad JSON
  if (!body.success) return Response.json({ error: "chat.invalid_input" }, { status: 400 });
  const validated = await safeValidateUIMessages<ChatMessage>({ messages: body.data.messages, tools: chatTools });
  if (!validated.success) return Response.json({ error: "chat.invalid_input" }, { status: 400 });

  const stream = llm.streamChat({
    instructions: "You answer questions about the team's projects.",
    messages: await convertToModelMessages(validated.data, { tools: chatTools }),
    tools: chatTools,
    stopWhen: isStepCount(3),
    timeoutMs: 60_000,
    abortSignal: request.signal, // the client's Stop ends the call: outcome llm.aborted
    attributes: { accountId: session.accountId },
  });
  after(() => stream.recorded);
  return stream.toUIMessageStreamResponse<ChatMessage>({ originalMessages: validated.data, onError: () => "chat.unavailable" });
}
```

The body limit, the message count, `validateUIMessages` (or `safeValidateUIMessages`) against the route's own tools,
the session check and the rate limit come before the model is called: a chat route is a public endpoint that spends
money. The error string the client sees is a code, never the provider's message.

#### Budgets on a chat

With `@softure-ai/metering`, reserve before the chat and settle from the record:

```ts
const reserved = await reserveSpend(meteringCtx, { provider: "openrouter", amount: estimateUsd, accountId });
if (!reserved.ok) return Response.json({ error: "chat.budget_exceeded" }, { status: 402 });
const stream = llm.streamChat({ ...chat, attributes: { accountId, reservationId: reserved.value.id } });
```

In `onCall`, for a record with `operation: "streamChat"` and a `reservationId` attribute: settle with `costUsd` when
it is not `null`; for `llm.aborted` or `llm.timeout` without usage, settle at the estimate (the provider billed the
part it streamed); for `llm.unavailable` without usage, release. Pass `createLlmUsageRecorder` as `onUsage` instead
when the app keeps a ledger without reservations.

## Embeddings

`createEmbedder` turns texts into vectors for search (a pgvector column, a vector index), with the same time limit,
error codes, records and spans as the text calls:

```ts
// lib/embedder.ts (server only)
import { createEmbedder, openAiCompatibleEmbeddingModel, workersAiEmbeddingModel } from "@softure-ai/llm";

// Cloudflare: the Worker's `ai` binding (wrangler.jsonc `"ai": { "binding": "AI" }`), no API key.
const onWorkers = createEmbedder({ model: workersAiEmbeddingModel({ binding: env.AI, model: "@cf/baai/bge-m3" }), dimensions: 1024 });

// Anywhere else: an OpenAI-compatible `/embeddings` endpoint (a self-hosted model server, or a hosted API).
const elsewhere = createEmbedder({
  model: openAiCompatibleEmbeddingModel({ baseUrl: process.env.EMBEDDINGS_URL ?? "", apiKey: process.env.EMBEDDINGS_API_KEY, model: "bge-m3" }),
  dimensions: 1024,
  pricing: { "bge-m3": { inputPerMillion: 0, outputPerMillion: 0 } },
});

const result = await elsewhere.embedTexts({ values: passages, attributes: { accountId } });
if (!result.ok) return result; // "llm.unavailable" | "llm.invalid_output" | "llm.timeout"
const { embeddings, usage, model } = result.value; // one vector per text, in order
```

| Option | Default | Meaning |
| --- | --- | --- |
| `model` | required | an AI SDK embedding model object, or one of the two adapters below |
| `dimensions` | required | the length every vector must have; another length fails the call with `llm.invalid_output` |
| `pricing` | `{}` | model id → `{ inputPerMillion, outputPerMillion }` (only the input price is used) |
| `onUsage`, `onCall`, `timeoutMs`, `maxRetries`, `clock`, `tracer` | as `createLlm` | `onCall` records have `operation: "embedTexts"`; the time limit covers every batch |

`embedTexts({ values, timeoutMs?, attributes? })` splits the texts into the model's batches (AI SDK `embedMany`) and
returns `Result<{ embeddings, usage, model, costUsd, costSource }, LlmErrorCode>`; no texts make no call. `modelId`
and `dimensions` on the embedder name what the vectors came from: store the model id next to them, so a change of model
can be found and re-embedded.

| Adapter | Options |
| --- | --- |
| `workersAiEmbeddingModel` | `binding` (`env.AI`), `model` (e.g. `@cf/baai/bge-m3`), `maxEmbeddingsPerCall` (default 100). Workers AI reports no token counts, so `usage` is 0 and `costUsd` is `null` |
| `openAiCompatibleEmbeddingModel` | `baseUrl` (`/embeddings` is appended), `model`, `apiKey?` (bearer), `dimensions?` (asks the API for shorter vectors), `maxEmbeddingsPerCall` (default 96), `provider` (default `openai-compatible`), `fetch` |

Both fail with AI SDK's `APICallError`: a network failure, a 408, 429 or 5xx and a throwing binding are retried within
`maxRetries`; anything else ends at once. Every failure is `llm.unavailable`.

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
| `operation` | `"generateStructured"`, `"generateText"` or `"streamChat"` |
| `model`, `provider` | the model id the provider answered with; without an answer, the requested one |
| `outcome` | `"ok"`, the call's error code, or `"llm.aborted"` for a `streamChat` the request aborted (`LlmOutcome`) |
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

Every call is one span, `llm.generate_structured`, `llm.generate_text`, `llm.stream_chat` (operation `chat`) or `llm.embed_texts` (operation `embeddings`), with `gen_ai.operation.name`, `gen_ai.provider.name`,
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

A streamed chat:

```ts
import { fakeChatModel } from "@softure-ai/llm/testing";

const model = fakeChatModel(
  { kind: "tool-call", toolName: "projectStatus", input: { projectId: "apollo" } },
  { kind: "text", text: "Apollo is 64% done." },
);
const stream = createLlm({ model }).streamChat({ prompt: "How is Apollo?", tools, stopWhen: isStepCount(3) });
expect(await stream.text).toBe("Apollo is 64% done.");
```

| Response | Effect |
| --- | --- |
| `{ kind: "text", text, usage?, providerMetadata? }` | streams `text` word by word and stops |
| `{ kind: "tool-call", toolName, input, text?, usage?, providerMetadata? }` | streams `text`, then calls the tool; the next step takes the next response |
| `{ kind: "truncated", text?, usage?, providerMetadata? }` | stops on the output token limit → `llm.output_truncated` |
| `{ kind: "unavailable" }` | fails like HTTP 503 before anything streams → `llm.unavailable` |
| `{ kind: "error", text? }` | streams `text`, then a provider error → `llm.unavailable` |
| `{ kind: "hang", text? }` | streams `text`, then waits for the abort → `llm.aborted` or `llm.timeout` |

Options: `modelId`, `provider`, `chunkDelayInMs` (default 0). `model.doStreamCalls` holds what each step sent.

An embedding model:

```ts
import { createEmbedder } from "@softure-ai/llm";
import { fakeEmbeddingModel } from "@softure-ai/llm/testing";

const model = fakeEmbeddingModel({ dimensions: 64 });
const embedder = createEmbedder({ model, dimensions: 64 });
```

Each vector comes from the words of its text (lower case, accents removed, hashed into buckets, length 1), so texts that
share words are close and texts that share none are not: enough to test ranking code without a network. Usage is one
token per word; `model.calls` holds the texts of every call. `behaviour`: `answer` (default), `unavailable`
(`llm.unavailable`), `hang` (`llm.timeout`), `wrong-dimensions` (`llm.invalid_output`). `embedWords(text, dimensions)`
gives the vector the fake answers for a text.

## Limitations

- `generateStructured` and `generateText` take no tools; tools are for `streamChat`.
- `streamChat` records an answer stopped half way without the unfinished step's tokens (the AI SDK reports none),
  and does not offer `streamRetries`.
- AI SDK 7 only (`ai@^7`).
- No built-in price list: prices change often and differ per provider, so the app keeps them.
