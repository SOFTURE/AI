---
change_id: llm-provider-cost-call-hook-805
status: archived
---

# Plan: provider cost and an onCall hook (issue #805)

Input: change.md, research.md. Complexity: small (one package: contract, call path, test double, tests, docs).

## Phase 1: the provider's cost and costSource

Files: `foundation/llm/src/contract.ts`, `src/usage.ts`, `src/create-llm.ts`, `src/tracing.ts`, `src/testing/index.ts`,
`tests/provider-cost-call-hook-805.test.ts`, existing tests that compare whole records.

1. Tests first: an answer with `providerMetadata.openrouter.usage.cost` gives that `costUsd` with `costSource:
   "provider"` in the result and in `onUsage`, also for a model without a price entry; without it the price table
   gives `"price_table"`; without either `costUsd: null`, `costSource: null`; a malformed or negative cost is ignored.
2. `contract.ts`: `CostSource = "provider" | "price_table"`; `costSource: CostSource | null` on `UsageRecord`,
   `StructuredResult` and `TextResult`.
3. `usage.ts`: `readProviderCostUsd(providerMetadata)` reads `openrouter.usage.cost` (finite, 0 or more), else `null`;
   `resolveCost(...)` picks provider over price table.
4. `create-llm.ts`: `callModel` carries the provider's cost of an answer; `runCall` resolves cost and source.
5. `tracing.ts`: span attribute `softure.llm.cost_source` next to `softure.llm.cost_usd`.
6. `fakeModel`: optional `providerMetadata` on `output`, `text` and `truncated` responses.

## Phase 2: onCall

Files: `src/contract.ts`, `src/create-llm.ts`, `src/index.ts`, the new test file.

1. Tests first: one record per call for `ok`, `llm.invalid_output`, `llm.output_truncated`, `llm.unavailable` (usage
   `null`, requested model) and `llm.timeout` (duration from the clock); attributes and operation name pass through;
   called after `onUsage`; a throwing hook propagates like `onUsage`; no hook, no change.
2. `LlmCallRecord { operation, model, provider, outcome, usage, costUsd, costSource, startedAt, durationMs,
   attributes }` and `LlmCallHook`; option `onCall`; exported from the package root.

## Phase 3: docs

Files: `foundation/llm/README.md`, `foundation/llm/CHANGELOG.md`.

1. README: `costSource`, the provider cost, `onCall` and its record; how an app drops its middleware and wrapper.
2. CHANGELOG `## Unreleased`.

## Decisions (auto)

- Option 1 of research.md.
- Field names follow #804 where the concept is the same: `outcome`, `startedAt`, `durationMs`; the hook is `onCall`
  as the issue proposes. `UsageRecord.at` stays (renaming it would break apps).
- `onCall` failure propagates like `onUsage`: one rule for both hooks in this package, and a ledger or spending limit
  that cannot write should not pass silently. (#804 logs and ignores; a tool answer there has no caller to propagate to.)
- Only OpenRouter's shape is parsed; another provider's figure can be added the same way when an app needs it.
- `costUsd` on the result follows the same choice as the record, so the two never disagree.

## Progress

- [x] Phase 1: provider cost and costSource (a8fa2db)
- [x] Phase 2: onCall (a8fa2db, one commit with phase 1: the test file covers both)
- [x] Phase 3: README and CHANGELOG (03fdb22)
- [x] Implementation review fix: one duration for both hooks (66848cb)
