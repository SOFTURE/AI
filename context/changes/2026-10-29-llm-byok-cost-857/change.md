---
change_id: llm-byok-cost-857
title: "llm: count the upstream cost of a BYOK call, and let a provider cost of 0 fall back to the price table (issue #857)"
status: open
roadmap_item: null
issue: 857
branch: claude/project-thread-o2kg84
created: 2026-10-29
updated: 2026-10-29
---

## Intent

Record what an OpenRouter call really cost. The provider's figure becomes `usage.cost` plus
`usage.costDetails.upstreamInferenceCost` (what the model's provider billed on a BYOK key), and a provider total of 0
no longer hides the price table: a priced model then gets `costSource: "price_table"`.

## Context

- Labels: bug, pkg: llm. [Issue #857](https://github.com/SOFTURE/AI/issues/857).
- Builds on the provider's billed cost (#805, llm 0.2.0).

## Constraints

- Only `foundation/llm`. No version bump: the coordinator releases. CHANGELOG under `Unreleased`.
- No other workspace package depends on `@softure-ai/llm`, so the release may be a patch or a minor.

## Notes

- `frame` skipped: the issue states the defect and the expected behaviour precisely.
