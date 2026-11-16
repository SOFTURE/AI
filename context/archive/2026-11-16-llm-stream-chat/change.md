---
change_id: llm-stream-chat
title: "llm: streamed chat with usage, cost and metering hooks (issue #1258)"
status: archived
roadmap_item: null
issue: 1258
branch: claude/project-thread-e6htx4
created: 2026-11-16
updated: 2026-11-16
---

## Intent

A chat route (AI SDK UI `useChat`) streams through `@softure-ai/llm` instead of calling AI SDK `streamText` directly,
so it keeps the client's model, time limit, `attributes`, `onUsage` / `onCall` (and with them the metering adapter),
pricing, provider-reported cost, error codes and tracing spans. The route still calls `toUIMessageStreamResponse()`.

## Context

Follow-up of the concept check #1248 (`context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md`, "What the
route can reuse" and "Budgets on streamed calls"). Issue #1258, labels `enhancement`, `pkg: llm`.

## Constraints

- Additive only: `generateStructured` and `generateText` keep their behaviour and records.
- Returns AI SDK's `StreamTextResult`; AI SDK types stay the request and result types (no re-modelled chat API).
- No new dependency; `ai@^7` peer range unchanged (7.0.0 already has `onEnd`, `onAbort`, `onStepEnd`, `timeout`).
- Released by the coordinator with the batch after #1258–#1261: CHANGELOG under `## Unreleased`, no version bump here.

## Notes

- Research reuses the #1248 spike (the same session's findings, archived); `research.md` records only what this change
  measured on top of it.
