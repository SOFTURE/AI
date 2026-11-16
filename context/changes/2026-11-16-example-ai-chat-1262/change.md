---
change_id: example-ai-chat-1262
title: "example: AI chat route on llm.streamChat and ui's chat primitives (issue #1262)"
status: plan_reviewed
roadmap_item: null
issue: 1262
branch: claude/project-thread-tcfi2m
created: 2026-11-16
updated: 2026-11-16
archived_at: null
---

## Intent

Close [issue #1262](https://github.com/SOFTURE/AI/issues/1262): the e2e harness (`examples/next-app`) gets a chat page
and route built the way the llm and ui READMEs recommend, so a streamed chat with a tool call is checked end to end:
streaming, the tool card, stop, retry and an invalid body (400).

## Context

Label: `enhancement`. Follow-up of the concept check #1248
(`context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md`, its spike in the project files as `spike.patch`).
Its prerequisites are on master: #1258 `llm.streamChat` and `fakeChatModel` (PR #1268, merge f8062d5) and #1259 ui's
chat primitives (PR #1270, merge 842f4f7). Both are unreleased; the example installs the packages packed from the
repository, so it does not wait for the release. #1260 (theme-notion) and #1261 (theme-flat-paint) style the same
primitives and do not touch the example; this change does not depend on them.

## Constraints

- Owns `examples/next-app/app/account/chat/`, `app/api/chat/`, `lib/chat/`, `e2e/chat.spec.ts`, the example's
  `package.json` / `package-lock.json`, `messages/en.ts` (a `chat` group), `softure.config.ts` (one rate limit bucket)
  and the example README.
- No package source changes, no version bump.
- No provider is called: the model is `fakeChatModel` from `@softure-ai/llm/testing`, scripted per scenario.

## Notes

- Framing: skipped. The concept check #1248 framed the problem; the issue names the outcome.
