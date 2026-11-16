# Plan: example-ai-chat-1262

Input: change.md, research.md. Complexity: medium (example app and its e2e only).

## Goal

A signed-in chat at `/account/chat` on `llm.streamChat` and ui's primitives, with e2e checks for streaming, the tool
card, stop, retry and invalid bodies.

## Approach

The route and page follow the llm and ui README recipes verbatim where possible, so the e2e also checks the docs.
Rejected: calling `streamText` directly (the issue asks for `llm.streamChat`); a separate fake provider server (the
packaged `fakeChatModel` already streams through the real AI SDK pipeline).

## Phase 1: chat route, page and e2e

**Discipline:** test-after (the e2e is the test). **Files:** `examples/next-app/package.json`, `package-lock.json`,
`lib/chat/tools.ts`, `lib/chat/llm.ts`, `app/api/chat/route.ts`, `app/account/chat/page.tsx`,
`app/account/chat/chat.tsx`, `messages/en.ts`, `softure.config.ts`, `app/account/page.tsx` (a link),
`e2e/chat.spec.ts`.

- Dependencies `@softure-ai/llm` (`file:`), `ai` 7.0.173, `@ai-sdk/react` 4.0.177.
- `lib/chat/tools.ts`: `getProjectStatus` (zod input and output), `ChatMessage` type.
- `lib/chat/llm.ts`: one `createLlm` client, a price table, and `pickChatModel(messages)` returning a scripted
  `fakeChatModel` per scenario.
- Route `POST /api/chat`: 401 without a session, 429 over the `example.chat` bucket, 413 / 400 from `readSmallBody`
  (64 kB), 400 on the zod body or `safeValidateUIMessages`, then `streamChat` with `abortSignal`, `stopWhen`,
  `attributes`, `after(() => stream.recorded)`, `toUIMessageStreamResponse({ onError: () => "chat.unavailable" })`.
- Page: `requireUser`, title from `messages.chat`, the client chat from the ui recipe with a `ToolCallCard` registry.
- e2e: streaming (busy log, streaming status, then the full answer), tool card done with the project figures, Stop
  ends a hanging answer and returns to Send, Retry after a failed answer, and the route's 401, 400 (malformed JSON,
  unknown part), 413.

Done when: `npx playwright test e2e/chat.spec.ts` passes against `next build` + `next start` on a migrated database;
`npx tsc --noEmit` in the example passes; root gates green.

## Phase 2: docs

Example README "What is in it" row; the package description lists llm.

## Risks and rollback

- Timing of streaming assertions: chunk delays are set so the streaming state lasts over a second. Rollback: revert
  the branch; nothing outside the example changes.

## Decisions (auto)

- `tests/repo/ci-affected.test.ts` used llm as the package no area reaches; the example now installs llm, so the
  test takes speech instead.

- Page under `/account/chat`, so the existing guard covers it; no proxy change.
- Scenario picked from the last user message text, documented in `lib/chat/llm.ts` as test scaffolding: a real app
  passes its provider's model.
- No rate limit e2e (the ping spec covers the limiter); the bucket is generous so parallel specs never hit it.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: chat route, page and e2e

#### Automated
- [x] 1.1 `e2e/chat.spec.ts` passes on `next build` + `next start` — 44c4ff5
- [x] 1.2 Example `tsc --noEmit` and root gates green (typecheck, lint, test) — 44c4ff5

### Phase 2: docs

#### Automated
- [x] 2.1 README row and description; markdown link test green — 1cb2128
