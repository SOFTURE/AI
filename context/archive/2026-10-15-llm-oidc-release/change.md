---
change_id: llm-oidc-release
title: "Document UsageRecord.outcome in the llm README and release llm 0.1.1 through the npm trusted publisher"
status: archived
roadmap_item: null
issue: null
branch: claude/project-thread-bb7u2m
created: 2026-10-15
updated: 2026-10-15
archived_at: 2026-10-15
---

## Intent

`@softure-ai/llm` has a trusted publisher on npm now, and nothing has been released through it yet. The smallest
useful patch documents `UsageRecord.outcome` (its values were not listed) and ships as 0.1.1, which proves that
the release workflow publishes `llm` through OIDC with provenance.

## Constraints

- Owns `foundation/llm/` README and CHANGELOG only. No code change.

## Notes

- Placement: unlinked one-off asked in chat, `roadmap_item: null`.
- Research: skipped. One README sentence read straight from `src/contract.ts` (`outcome: "ok" | LlmErrorCode`) and
  the README's own rule that only `llm.invalid_output` records usage among failures.
- Framing: skipped. Nothing about the problem is in doubt.
- Archived 2026-10-15: README documents `outcome`; released as `llm@0.1.1`.
