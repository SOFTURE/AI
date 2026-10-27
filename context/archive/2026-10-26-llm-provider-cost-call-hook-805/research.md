---
change_id: llm-provider-cost-call-hook-805
---

# Research: provider cost and a hook per call (issue #805)

## Findings

- `foundation/llm/src/create-llm.ts`: `runCall` starts a span, runs `callModel`, and calls `onUsage` only when the
  outcome carries usage (answered, or failed with `llm.invalid_output` / `llm.output_truncated`). A timeout returns
  before any hook; `llm.unavailable` has no usage, so it is skipped too. A throw from `onUsage` propagates (README).
- `costUsd` comes from `getCostUsd(pricing, answeredModel, usage)` (`src/usage.ts`): `null` without a price entry.
- AI SDK 7 (`ai` 7.0.122): the `generateText` result carries `providerMetadata: ProviderMetadata | undefined` (record
  of provider name to JSON object). OpenRouter's provider puts the billed USD at `openrouter.usage.cost` (number).
  `NoObjectGeneratedError` carries `response`, `usage` and `finishReason` but no provider metadata, so a structured
  `llm.invalid_output` thrown by the SDK can only be priced from the table.
- `src/testing/index.ts` (`fakeModel`): `doGenerate` results are built in `toResult`; `LanguageModelV4GenerateResult`
  accepts an optional `providerMetadata`, so a scripted answer can carry it.
- #804 (PR #806) names its record `ToolCallRecord { tool, …, outcome, startedAt, durationMs }` and the option
  `onToolCall`. In this package the outcome is already the string `"ok" | LlmErrorCode` (`UsageRecord.outcome`).

## Options

1. `costUsd` prefers the provider's figure, plus `costSource`; a separate `onCall` hook with its own record for every
   finished call. Additive; `onUsage` keeps its meaning (calls with usage).
2. Call `onUsage` with zero usage for failures. Changes what existing ledgers and quotas receive (rows with zero
   tokens they did not ask for).
3. Pass raw `providerMetadata` in `UsageRecord` and leave parsing to the app. Keeps the app's provider-specific code.

Recommendation: option 1.
