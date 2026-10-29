---
change_id: llm-byok-cost-857
status: planned
---

# Plan: BYOK upstream cost and a provider cost of 0 (issue #857)

Input: change.md, research.md. Complexity: small (one function pair, tests, docs).

## Phase 1: the cost rule

Files: `foundation/llm/src/usage.ts`, `foundation/llm/tests/byok-cost-857.test.ts`.

1. `readProviderCostUsd` sums `openrouter.usage.cost` and `openrouter.usage.costDetails.upstreamInferenceCost`;
   each part counts only when it is a finite non-negative number; no usable part → `null`.
2. `resolveCost`: a provider figure above 0 wins (`"provider"`); otherwise the price table (`"price_table"`); when the
   model has no price and the provider said 0, the result stays `0 / "provider"`; otherwise `null / null`.
3. Tests (fail before the fix): BYOK `cost: 0` + upstream → the upstream figure; fee + upstream → the sum; upstream
   only; cost 0 with a price → price table; cost 0 without a price → `0 / "provider"`; an unusable upstream part is
   ignored next to a usable cost.

## Phase 2: docs

`foundation/llm/README.md` (Usage and cost, fake model example), `CHANGELOG.md` `Unreleased` with the migration
(drop the app's own middleware workaround).

## Decisions (auto)

- A provider total of 0 for a model without a price stays `0 / "provider"` rather than `null`: free models really
  cost 0, and the issue asks for the fallback only "when the model has a price".
- An unusable part (string, negative, NaN) is skipped, not fatal for the other part.

## Progress

- [x] Phase 1: the cost rule (4c3182e, llm tests green)
- [ ] Phase 2: docs
