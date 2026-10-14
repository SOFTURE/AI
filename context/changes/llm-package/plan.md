# Plan: llm-package

Input: change.md, research.md (framing skipped). Complexity: medium (one new package, two phases).

## Goal

A new workspace package `foundation/llm` (`@softure-ai/llm` 0.1.0) with two entries:

- `.`: `createLlm(options)` returning `{ generateStructured }`, the `LLM_ERROR_CODES` list and the types;
- `./testing`: `fakeModel(...responses)`.

**Out of scope:** a provider layer or `softure.config.ts` entry (owner's narrowed scope), streaming, tools, a usage
table, a release.

## Key decisions

- **D1 options.** `createLlm({ model, pricing?, onUsage?, timeoutMs? = 30_000, maxRetries?, clock? = systemClock })`.
  `model` is the AI SDK `LanguageModel` object the app built (a gateway id string is accepted by the type and
  reported as provider `gateway`). Options are validated at creation (positive timeout, non-negative prices) and throw
  a `RangeError` naming the option: a wrong config is a programming error.
- **D2 call.** `generateStructured({ schema, system?, prompt, timeoutMs?, model?, attributes? })` →
  `Promise<Result<{ output, usage, model, costUsd }, LlmErrorCode>>`. `model` overrides the default per call (a
  cheaper model for one task). `attributes` (`Record<string, string>`, e.g. `{ accountId }`) travel to `onUsage`
  only, never to spans (they may identify a person).
- **D3 timeout.** The package's own `AbortController` aborts the SDK call after `timeoutMs`; the call also races a
  timer, so a model that ignores the signal still ends as `llm.timeout`. The SDK promise gets its own rejection handler
  before the race, so a late rejection is never unhandled (plan review F1). The timer is cleared on every path.
- **D4 error mapping** (research table): `NoObjectGeneratedError` → `llm.invalid_output`; our abort or a
  `TimeoutError` → `llm.timeout`; any other `AISDKError` → `llm.unavailable`; anything else is rethrown.
- **D5 usage and cost.** `LlmUsage = { inputTokens, outputTokens, totalTokens, cachedInputTokens, reasoningTokens }`,
  numbers, `0` where the provider reports nothing. `pricing` maps a model id to `{ inputPerMillion, outputPerMillion,
  cachedInputPerMillion? }` in USD; cached input tokens are billed at the cached price when given, else at the input
  price. `costUsd` is `null` when the model has no price. `onUsage(record)` is awaited after every call that reached
  the model and reported usage (success and `llm.invalid_output`); the record is `{ model, provider, usage, costUsd,
  outcome: "ok" | LlmErrorCode, durationMs, at, attributes }`. A throwing hook propagates (it is the app's bug, and a
  quota that silently stops counting is worse).
- **D6 span.** Tracer `@softure-ai/llm`, span `llm.generate_structured` with `gen_ai.operation.name`,
  `gen_ai.provider.name`, `gen_ai.request.model`, `gen_ai.response.model`, `gen_ai.usage.input_tokens`,
  `gen_ai.usage.output_tokens`, `softure.llm.cost_usd`, `softure.llm.outcome`; status `ERROR` with the code as message
  on failure. No prompt, output or attributes. `@opentelemetry/api` is a dependency (no-op without an SDK). `createLlm` takes an optional `tracer`
  (default: the global tracer), so a test uses its own provider (plan review F2).
- **D7 fake model.** `fakeModel(...responses)` returns an AI SDK model (`MockLanguageModelV4`) answering each call
  with the next response, the last one repeating. A response is a discriminated union: `{ kind: "output", value }`
  (serialised to JSON), `{ kind: "text", text }` (raw, to provoke invalid output), `{ kind: "unavailable" }` (an
  `APICallError` 503), `{ kind: "hang" }` (never answers until aborted). Usage per response defaults to 10 in / 5 out.
  `model.doGenerateCalls` exposes what the package sent.
- **D8 dependencies.** peers `ai ^7.0.0`, `zod ^4.0.0`; dependencies `@softure-ai/core`, `@opentelemetry/api`; dev
  `ai 7.0.122` (two weeks old), `zod`, `@opentelemetry/sdk-trace-base` (plan review F5). Usage comes from
  `totalUsage` (F4).

## Phase 1: package and core call (TDD)

**Files:** `foundation/llm/{package.json,tsconfig.json,tsconfig.build.json,CHANGELOG.md,README.md}`,
`src/index.ts`, `src/contract.ts`, `src/create-llm.ts`, `src/usage.ts`, `src/testing/index.ts`,
`tests/generate-structured.test.ts`, `tests/usage.test.ts`, `tests/fake-model.test.ts`, `package-lock.json`.

Done when tests cover: valid output; invalid JSON and wrong shape → `llm.invalid_output` with usage recorded;
provider failure → `llm.unavailable` and no usage record; hang → `llm.timeout` (fake timers), timer cleared on
success; a non-SDK error propagates; per-call model and timeout override; cost with and without cached price, unknown
model → `null`; invalid options throw; `fakeModel` cycles and repeats its last response.

## Phase 2: span, docs

**Files:** `src/tracing.ts`, `tests/tracing.test.ts` (in-memory span exporter from `@opentelemetry/sdk-trace-base`,
already in the lockfile through observability), README, CHANGELOG, root `README.md` package list.

Done when the span test shows attributes and status for a success and a failure and no prompt text; gates green
(typecheck, lint, test, build).

## Risks and rollback

- AI SDK 8 changes the call shape; the peer range stops at 7, so an app on 8 gets a peer warning, not a silent break.
- Rollback: revert the merge; nothing else depends on the package.

## Progress

#### Automated

- [ ] Phase 1: package and core call
- [ ] Phase 2: span, docs
- [ ] Gates: typecheck, lint, test, build

## Before the next release

- First publish of `@softure-ai/llm` uses `NPM_TOKEN` (release.yml); afterwards bind the npm trusted publisher to
  `release.yml` for the new package name (scripts/release/README.md).
