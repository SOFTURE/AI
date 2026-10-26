---
change_id: llm-provider-cost-call-hook-805
title: "llm: the provider's billed cost in the usage record and an onCall hook per call (issue #805)"
status: archived
roadmap_item: null
issue: 805
branch: claude/project-thread-eni8wl
created: 2026-10-26
updated: 2026-10-26
archived_at: 2026-10-26
---

## Intent

Close [issue #805](https://github.com/SOFTURE/AI/issues/805): an app that keeps a ledger of every LLM call cannot get
the cost the provider billed (OpenRouter's `providerMetadata.openrouter.usage.cost`) through `onUsage`, and calls that
end in `llm.unavailable` or `llm.timeout` never reach any hook. After the change, `costUsd` prefers the provider's
figure and a `costSource` (`"provider"` | `"price_table"` | `null`) says where it came from, and an optional `onCall`
hook receives one record for every finished call, failures included, with the outcome code and the duration.

## Context

- Labels: enhancement, `pkg: llm` (found adopting `@softure-ai/llm` 0.1.2 in an adopting app).
- The adopting app wraps the model in an AI SDK middleware joined to `onUsage` through `AsyncLocalStorage`, and wraps
  `generateStructured` / `generateText` to see failed calls.
- A sibling change (#804, mcp-access `onToolCall`) names its record fields `outcome`, `startedAt`, `durationMs`.

## Constraints

- Additive: an app without `onCall` and without a provider cost sees the same values as before, plus `costSource`.
- No release in this change: the coordinator releases in a batch.

## Notes

- Framing: skipped. The issue names the gap and a concrete proposal.
