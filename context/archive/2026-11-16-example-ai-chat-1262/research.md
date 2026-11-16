# Research: example-ai-chat-1262

Sources: issue #1262, `context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md` and its spike patch,
`foundation/llm/README.md` ("A chat route"), `foundation/ui/README.md` ("Chat", the `useChat` recipe),
`foundation/llm/src/stream-chat.ts`, `foundation/llm/src/testing/fake-chat-model.ts`, `foundation/ui/src/ui/chat.tsx`,
the example's `app/api/security/ping/route.ts`, `app/account/page.tsx`, `proxy.ts`, `e2e/accounts.ts`.

## Findings

- **Versions.** `@ai-sdk/react` pins `ai` exactly: 4.0.177 depends on `ai` 7.0.173 (npm registry), the pair the issue
  was tested with. The example takes both; llm's peer `ai ^7` accepts it, so the example holds one copy of `ai`.
  The root workspace (llm's devDependency `ai` 7.0.163) is untouched: the example has its own lockfile and the root
  `tsconfig.json` excludes `examples/`.
- **Packages.** The example installs workspace packages packed (`install-links`); `@softure-ai/llm` joins as a
  `file:` dependency. `scripts/ci/affected.mjs` reads those `file:` dependencies, so llm changes reach the e2e job.
- **Authorization.** `/account` is guarded by `proxy.ts` and `requireUser`; a page at `/account/chat` gets both. The
  route uses `getCurrentUser()` (no redirect in a route handler) and answers 401 without a session.
- **Rate limit and body.** The ping route shows the pattern: `consumeRateLimit` on a declared bucket (429 with
  `retry-after`), then `readSmallBody` with a byte cap (413 / 400). The chat bucket is keyed by the user id.
- **Validation.** zod caps the message count; `safeValidateUIMessages({ messages, tools })` rejects unknown parts and
  tool parts that fail the schemas (both 400 in the spike).
- **Streaming.** `llm.streamChat` accepts a per-request `model`, so one `createLlm` client serves every scenario.
  `fakeChatModel` scripts `text`, `tool-call`, `error` and `hang` (ends only on abort) with `chunkDelayInMs`.
  `stream.recorded` goes to Next.js `after`. `abortSignal: request.signal` makes Stop end the call (`llm.aborted`).
- **Scenarios for the e2e.** The fake has no notion of a prompt, so the example picks the script from the last user
  message: a project question streams a sentence, calls `getProjectStatus`, then answers; "take your time" hangs
  (Stop); "fail once" fails the first attempt of that message and answers the retry (`regenerate` resends the same
  message id, so a module-level set of failed ids gives a deterministic second attempt); anything else streams a
  slow text answer (streaming is observable as `data-status="streaming"` and `aria-busy="true"`).
- **UI.** The ui recipe maps parts to `ChatLog`, `ChatMessage`, `ChatComposer`, `ToolCallCard`, `ChatEmptyState`,
  `ChatError`; their copy comes from `uiMessages.en.chat`. App copy (page title, tool title, figures) goes into the
  example's `messages/en.ts`.
