---
change_id: theme-flat-paint-chat-look-1261
title: "theme-flat-paint: look maps for the chat primitives (issue #1261)"
status: open
roadmap_item: null
issue: 1261
branch: claude/project-thread-pety6o
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [issue #1261](https://github.com/SOFTURE/AI/issues/1261): give ui's chat primitives (#1259) the Flat Paint look
where it differs from what the `--sft-*` bridge already gives them, so an app passes one class map per component
instead of writing its own: lime only as paint, every state carried by more than colour, and the type scale's steps.

## Context

Labels: `enhancement`, `pkg: theme-flat-paint`. Follow-up of the concept check #1248
(`context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md`, answer 4) and of #1259 (merged in PR #1270,
`842f4f7`), which exported every chat slot type and put `data-role` / `data-status` on a message and `data-state` on
a tool card. Package: `themes/theme-flat-paint` 0.3.0. The theme-notion side is #1260 (another thread).

## Scope

- Look maps in `src/look/chat.ts` for `ChatLog`, `ChatMessage`, `ChatComposer`, `ToolCallCard`,
  `ReasoningDisclosure`, `ChatEmptyState`, `ChatError`, exported with their slot types.
- Tests: slot sets match ui's, the compiled CSS carries every class, and a browser test in both schemes at 390 and
  1440 px that measures the rendered look (colours, outline, state carriers, no horizontal overflow).
- README (look maps table, a chat example, the `text-page` note for titles), CHANGELOG `Unreleased`.

## Constraints

- Only theme utilities and roles; lime (`accent-fill`) only as a fill with `on-accent` text.
- No change to ui; no version bump (the coordinator releases the batch).

## Notes

- Framing: skipped. The concept check #1248 framed the problem; the issue names the solution and it is additive.
