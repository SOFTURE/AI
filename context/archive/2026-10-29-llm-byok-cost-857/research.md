---
change_id: llm-byok-cost-857
status: done
---

# Research

- `foundation/llm/src/usage.ts`: `readProviderCostUsd` reads only `providerMetadata.openrouter.usage.cost` and
  returns any finite non-negative number; `resolveCost` takes any non-null provider figure (0 included) as
  `costSource: "provider"`. Both are internal (not exported from `index.ts`); `create-llm.ts` calls them once per
  answer (line ~269) and in the record builder (line ~167).
- `@openrouter/ai-sdk-provider` maps OpenRouter's `usage.cost_details.upstream_inference_cost` to
  `providerMetadata.openrouter.usage.costDetails.upstreamInferenceCost` (the issue's report). On a BYOK key
  `usage.cost` is OpenRouter's fee (0 within the free allowance) and the upstream cost is the model provider's charge.
- Tests: `tests/provider-cost-call-hook-805.test.ts` covers the provider figure, the fallback for unusable values,
  and "the provider's cost for a model the price table does not list" with a cost of 0 (`[0, "provider"]`).
- Free models (`:free` on OpenRouter) also report `usage.cost = 0` and have no price: keeping `0 / "provider"` for an
  unpriced model stays truthful and keeps the existing test.
- README "Usage and cost" and the fake model docs describe the provider figure; CHANGELOG has no `Unreleased` yet.
