# Research: AI SDK UI against the design kits and `@softure-ai/llm`

Change `ai-sdk-ui-concept-check`, issue #1248. Base: `master` at `9efd0cb3`. Date: 2026-11-16.

## Summary

AI SDK UI fits the stack and the design kits without friction. `useChat` streams in a client component of a Next.js
16 App Router app. A chat built only from `@softure-ai/ui` primitives and the `--sft-*` tokens rendered correctly in
`theme-notion` and `theme-flat-paint`, light and dark, with no code specific to either theme. That includes a tool
call rendered as a themed card. The gap is on the server: `@softure-ai/llm` offers no streaming. A chat route
therefore calls AI SDK Core's `streamText` directly, and loses `llm`'s timeouts, error codes, spans and `onUsage` /
`onCall` hooks (and with them the metering adapter). Only the price table (`getCostUsd`) carries over.

**Recommendation: integrate in two steps, without a new package yet.** (1) `@softure-ai/llm` gets `streamChat`, which
wraps `streamText` and keeps its contract (usage, cost, metering, spans, error codes), plus a streaming fake model.
(2) `@softure-ai/ui` gets a small, headless-friendly set of chat primitives on the `--sft-*` tokens, with AI SDK
types only at the edge. A separate `ai-ui` package is a proposal for the owner, worth it only once a second
framework or a second consumer needs it (see "Proposal for the owner").

## Versions tested

| Package | Version | Source |
| --- | --- | --- |
| `ai` (AI SDK Core and UI types) | 7.0.173 (Apache-2.0, published 2026-11-13) | npm registry |
| `@ai-sdk/react` | 4.0.177; depends on the exact `ai@7.0.173`, `@ai-sdk/mcp` 2.0.99, `@ai-sdk/provider` 4.0.38, `@ai-sdk/provider-utils` 5.0.81, `swr` ^2.4.1, `throttleit` 2.1.0 | npm registry |
| `next` / `react` | 16.4.5 (Turbopack) / 19.3.0 | `examples/next-app` |
| `zod` | 4.x (`ai` peer: `^3.25.76 \|\| ^4.1.8`) | `examples/next-app` |
| `tailwindcss` / `@tailwindcss/postcss` | 4.3.4 | root lockfile |
| `@softure-ai/ui` | 0.3.7 | `foundation/ui` |
| `@softure-ai/llm` | 0.2.3 (devDependency `ai` 7.0.163, peer `ai ^7.0.0`) | `foundation/llm` |
| `@softure-ai/theme-kit` / `theme-notion` / `theme-flat-paint` | 0.1.8 / 0.16.2 / 0.3.0 | `themes/*` |
| Chromium for the screenshots | system Google Chrome via Playwright 1.65.0 | container |

Docs consulted (AI SDK 7): [overview](https://ai-sdk.dev/docs/ai-sdk-ui/overview),
[chatbot](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot), [tool usage](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-tool-usage),
[generative UI](https://ai-sdk.dev/docs/ai-sdk-ui/generative-user-interfaces),
[stream protocol](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol),
[message persistence](https://ai-sdk.dev/docs/ai-sdk-ui/chatbot-message-persistence),
[object generation (`useObject`)](https://ai-sdk.dev/docs/ai-sdk-ui/object-generation),
[`useChat` reference](https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat),
[`streamText` reference](https://ai-sdk.dev/docs/reference/ai-sdk-core/stream-text),
[testing](https://ai-sdk.dev/docs/ai-sdk-core/testing). The session's network could not reach ai-sdk.dev, so every
API claim below was checked against the installed type declarations (`node_modules/ai/dist/index.d.ts`,
`@ai-sdk/react/dist/index.d.ts`) and the running spike, not against the pages.

## Answers

### 1. Fit with the stack

- **It works.** `useChat` from `@ai-sdk/react` 4.0.177 runs in a `"use client"` component. The page around it is a
  server component (`ChatPage` reads the copy with `getMessages(config.locale)` and passes it down as props). The route
  is a plain App Router `POST` handler returning `result.toUIMessageStreamResponse()` (Server-Sent Events). Turbopack
  bundled everything with `turbopack.root` limited to the app folder. No bundler plugin and no `next.config` change
  were needed.
- **Peer dependencies.** `@ai-sdk/react`: `react ^18 || ~19.0.1 || ~19.1.2 || ^19.2.1`, which React 19.3.0 satisfies.
  `ai`: `zod ^3.25.76 || ^4.1.8`, which the repository's zod 4 satisfies. `npm install` reported no peer conflict.
- **Exact pin.** `@ai-sdk/react` pins `ai` exactly. An app that also declares `ai` (for the route, and through `llm`'s
  peer) must keep it on the same patch, or it ends up with two copies of `ai` and type mismatches between the hook
  and the route. Dependabot's grouped minor/patch update handles this if both move in one group.
- **L-001 (tsc builds, `"use client"` kept).** `@ai-sdk/react`'s `dist/index.js` carries no `"use client"`
  directive, so it may only be imported from a file that has one. A SOFTURE package that wraps it builds with
  `tsc` and puts `"use client"` on its own component files, as `ui` already does. Nothing here needs a bundler.
- **L-002 (bare `next/*` imports).** AI SDK UI imports nothing from `next/*`, so the rule does not come into play.
  A wrapper needs no `next` import either: the route side is a web-standard `Request` -> `Response`.
- **Tailwind.** Only the themes need Tailwind 4 (their `theme.css`). AI SDK UI itself is unstyled.
  `examples/next-app` uses no Tailwind, so the spike added `postcss.config.mjs` and a per-route theme stylesheet.

### 2. Fit with `@softure-ai/llm`

- **`llm` cannot back a `useChat` route today.** It exposes `generateStructured` and `generateText`. Its README says
  "Streaming is not offered", and `fakeModel` implements only `doGenerate`. `useChat` needs a UI message stream, which
  only `streamText(...).toUIMessageStreamResponse()` (or `createUIMessageStream`) produces.
- **What the route can reuse.** The model object: `LlmModel` is `Exclude<LanguageModel, string>`, so the same
  provider instance an app passes to `createLlm` goes into `streamText`. The price table, through `getCostUsd(pricing,
  model, usage)`. In the spike, `onEnd({ totalUsage })` computes the cost of the whole multi-step answer (two model
  calls, 1,072 tokens, 0.00432 USD at 3/15 USD per million). `messageMetadata` on the `finish` part sends the same
  figure to the client.
- **What is lost on streamed calls when the route bypasses `llm`:** `onUsage` and `onCall` (so
  `createLlmUsageRecorder` of `@softure-ai/metering` does not fire), the `llm.*` error codes, `llm`'s timeout handling
  (`streamText` has its own `timeout` and `abortSignal`), the OpenTelemetry spans, and the provider-reported cost
  (`readProviderCostUsd` and `resolveCost` are internal, not exported). `toLlmUsage` is internal too, so the spike
  copied its five lines.
- **Budgets on streamed calls.** Metering's `reserveSpend` belongs before `streamText`, and `settleSpend` in `onEnd`
  with the total cost. `releaseSpend` belongs in `onError` / `onAbort` when nothing was billed. A user who presses
  Stop mid-answer is still billed for the tokens already generated, so an aborted stream should settle, not release.
  `llm` is the right place to own this sequence once, rather than every route.
- **Conclusion.** Add `llm.streamChat` (or `streamText`) that wraps AI SDK's `streamText`, keeps `llm`'s options
  (`model`, `timeoutMs`, `attributes`, `onUsage`, `onCall`, `tracer`, pricing) and returns the `StreamTextResult`, so
  the route still calls `toUIMessageStreamResponse()`. Add a streaming fake model next to `fakeModel`. AI SDK's own
  `MockLanguageModelV4` (from `ai/test`) with `simulateReadableStream` worked for the spike and is the basis.

### 3. Where it lives

| Option | For | Against |
| --- | --- | --- |
| A. Chat primitives in `@softure-ai/ui` (on `--sft-*`), streaming in `llm` | One place for every app; every theme that bridges `--sft-*` styles them for free (shown by the spike); fits how flat-paint already works (it ships no components) | `ui` gains an optional dependency on `@ai-sdk/react` or must stay type-only; `ui` releases follow AI SDK majors |
| B. New package (e.g. `@softure-ai/ai-ui`) on `ui` + `llm` | Keeps `ui` free of AI SDK; versioned with AI SDK majors on its own | One more package to release and keep in the e2e; the amount of code (a handful of components) is small for a package |
| C. Documentation and recipes only | No maintenance, no version coupling | Each app (or agent) rebuilds the same components, which is the inconsistency the issue starts from |

The spike shows that the components themselves need nothing that `ui` lacks. A message list, a bubble per role, a
tool card, an input with stop and retry, and error and empty states were all built from `Card`, `Stat`,
`ProgressBar`, `Field`, `Button`, `FormError`, `EmptyState` and 80 lines of CSS on `--sft-*` tokens. The coupling to
AI SDK can stay in one adapter: the components take plain props (role, text, status, tool state and output), and
one small hook maps `UIMessage` parts to them. Recommended: **A**, with the components free of AI SDK types
(`ui` takes no dependency) and the mapping shipped as a documented recipe in `ui`'s README. If the owner prefers a
package for the adapter, that is **B** in its thin form (see the proposal).

### 4. Theme contract

- Needed for chat and generative UI: a message list (`role="log"`), a message bubble per role, streaming text, a
  tool call card (pending, done and error states), a reasoning block (collapsible: `CollapsibleSection` /
  `CardDisclosure` exist), attachments (`FileUIPart`: a file chip), an input with send, stop and retry, an error
  state, an empty state, and a typing/busy indicator.
- **Expressible through the existing contract.** Two contracts exist. theme-kit's `ThemeDefinition` with
  `SHADCN_COLOR_ROLES` covers shadcn components (theme-notion's own). ui's `--sft-*` tokens are what each theme's
  `sft-bridge.css` maps onto its roles. Components on `--sft-*` render in every theme without per-theme code. The
  spike proved this for colours, fonts, radii, the dark scheme, and accent and tone states (screenshots).
- **Two catches found by the spike:**
  - theme-notion's bridge applies only inside `[data-page-frame]` (its `PageFrame`); outside it, ui's defaults show.
    The chat must sit in a `PageFrame` (the spike's notion layout does that). The root layout's legal footer, outside
    the frame, kept ui's default look.
  - theme-flat-paint uses Tailwind's full preflight, which resets heading styles. A page title needs the theme's
    class (`text-page`), and the spike passes it from the route. The chat itself was unaffected (ui's own classes).
- Per-theme polish (flat-paint's look maps such as `CARD_TITLE_LOOK`; notion's `Status` badge instead of a `Stat`)
  is optional and goes through `classNames`, as for every other ui component.

### 5. Generative UI

- AI SDK 7 types each static tool part as `tool-<name>`. Its `state` is one of `input-streaming`, `input-available`,
  `approval-requested`, `approval-responded`, `output-available`, `output-error` or `output-denied`, and
  `InferUITools<typeof tools>` types `input` and `output` from the tools' zod schemas. A tool-name to component registry
  is therefore a typed record `{ [name]: (part) => ReactNode }` with an exhaustive `switch` on `state`. The spike's
  `ProjectStatusCard` shows a busy card until `output-available`, `FormError` on `output-error`, then `Card` + `Stat`
  + `ProgressBar`.
- **Safe by default.** Parts are data, never HTML: React escapes text, and nothing in AI SDK UI renders markup. The
  spike validates at three boundaries: `outputSchema` on the tool (its `execute` parses with zod), the request body
  (zod, at most 40 messages and 64 kB), and `safeValidateUIMessages({ messages, tools, metadataSchema })`. That call
  rejects unknown part types and tool inputs or outputs that fail the schemas, because the client sends back the
  whole history, tool outputs included. Measured: a body with an unknown part type answers 400, and malformed JSON
  answers 400.
- Gotcha: `metadataSchema` is applied to every message, so a schema for assistant metadata must accept `undefined`
  (user messages carry none). Without `.optional()` the spike's first request was refused.
- Markdown rendering of streamed text (lists, code) is not part of AI SDK UI. If needed, it must be a sanitising
  renderer with no raw HTML. That is a decision for the follow-up, not a blocker.

### 6. Messages and accessibility

- **Copy.** AI SDK UI ships no user-visible text. Every label in the spike (`aria-label` of the log and the section,
  role names, input label and placeholder, Send, Stop, Try again, error, tool states, the cost line) came from
  `messages/en.ts` (`aiChat`), through a server component as props. In `ui` the same texts would join `uiMessages.en`
  and be overridable through `UiLocaleProvider messages`, like the existing groups. Server error codes
  (`ai_chat.invalid_input`, `ai_chat.unavailable` via `onError`) stay codes and are translated by the client.
- **Live region.** The list is `<ol role="log" aria-live="polite" aria-busy>` (verified in the DOM in all four
  runs). Open point: a token-by-token `aria-live` can flood screen readers. The usual pattern announces the finished
  message (or every sentence), while `aria-busy` stays true during streaming. `useChat`'s `throttle` option also
  limits re-renders. This needs a screen-reader check in the follow-up; the spike did not do one.
- **Keyboard and focus.** Enter sends and Shift+Enter adds a new line (used by the screenshot run). Send turns into
  Stop while `status` is `submitted` or `streaming`. Retry calls `regenerate()`. Focus stays in the input after
  sending. ui's focus ring (`--sft-color-focus`) took each theme's colour.

### 7. Security and limits

- **Authorization.** The route is an ordinary route handler, so `@softure-ai/auth`'s session check and the project
  rule "every route checks authorization" apply unchanged. The spike, which has no data behind it, skipped auth and
  marked the spot.
- **Rate limiting.** `@softure-ai/security`'s fixed-window limiter and its size-capped body reader fit as they are. A
  chat route also needs a spend limit, which is metering's budget (question 2), because a single request can run
  several model steps (`stopWhen: isStepCount(n)` caps them).
- **Input validation.** zod on the body plus `safeValidateUIMessages`, as above. The model never sees tool outputs
  that fail their schema.
- **Persistence.** AI SDK UI keeps messages in client state. Persisting them is the app's job (`onFinish` /
  `toUIMessageStreamResponse({ originalMessages, onFinish })` gives the full message list; the docs page "message
  persistence" shows the pattern). Stored chats are personal data. A module that stores them must contribute export
  and deletion to `@softure-ai/privacy` (`defineModule({ privacy: { exportUserData, deleteUserData } })`). That
  argues for leaving storage out of the first iteration.
- **Prompt injection through tools.** Out of scope for UI. Tool `execute` functions must check the caller's
  authorization themselves, since the model chooses their inputs.

### 8. Cost of adoption

- **Bundle.** `useChat` + `DefaultChatTransport` bundled with esbuild 0.25.10 (minified, React external): 206 kB raw,
  56 kB gzipped. That includes zod, which an app on ui usually ships already. Not measured: the share inside a full
  `next build` route bundle (the spike ran `next dev` only).
- **Licence.** `ai` and `@ai-sdk/*` are Apache-2.0, compatible with the repository's MIT packages (attribution through
  their own `LICENSE` in `node_modules`, no copyleft).
- **Release cadence.** Majors: `ai` 5.0.0 (2025-07-31), 6.0.0 (2025-12-22), 7.0.0 (2026-06-25), so about one every
  six months. Each moved message part and transport APIs (`parts`, tool states, `instructions`, `isStepCount`).
  Patches: 164 releases of 7.0.x since June and 30 in the last 30 days, nearly daily. Every major is a change in
  `llm` (already the case: its peer is `ai ^7`) and in whatever wraps `useChat`. Keeping AI SDK types out of the ui
  components limits a major to the adapter.

## Spike

What ran (2026-11-16, in the worktree, not committed; the full diff is kept outside the repository as `spike.patch`):

- `examples/next-app` gained the dependencies `ai` 7.0.173, `@ai-sdk/react` 4.0.177 and `tailwindcss` /
  `@tailwindcss/postcss` 4.3.4, plus `file:` dependencies on `@softure-ai/llm`, `theme-kit`, `theme-notion` and
  `theme-flat-paint`. It also gained `postcss.config.mjs` and these files:
  - `lib/ai-chat/tools.ts`: a `getProjectStatus` tool with zod input and output schemas, the message metadata schema,
    and `ChatMessage = UIMessage<ChatMetadata, UIDataTypes, InferUITools<typeof chatTools>>`;
  - `lib/ai-chat/mock-model.ts`: `MockLanguageModelV4` (from `ai/test`) with two streams, each via
    `simulateReadableStream` (60 ms per word). Step 1 streams a sentence and a `tool-call`; step 2 streams the answer.
    Each stream reports usage;
  - `app/api/ai-chat/route.ts`: a size cap, zod body, `safeValidateUIMessages`, and
    `streamText({ model, instructions, messages: await convertToModelMessages(...), tools, stopWhen: isStepCount(3),
    timeout, onEnd })`. Cost comes from `getCostUsd` of `@softure-ai/llm` and goes to the client through
    `toUIMessageStreamResponse({ originalMessages, messageMetadata, onError })`;
  - `app/ai-chat/chat.tsx` + `chat.css`: the client chat on `useChat`, using only `@softure-ai/ui` components and
    `--sft-*` tokens;
  - `app/ai-chat/{notion,flat-paint}/{layout,page}.tsx` + `theme.css`: one route per theme, each wired as its README
    says (notion: the scoped-preflight variant inside `PageFrame`);
  - `messages/en.ts`: an `aiChat` group with all copy.
- Commands: root `npm ci` and `npm run build` (both exit 0), `npm install` in `examples/next-app`, `npx tsc --noEmit`
  (clean), `next dev --port 3248` (no database needed for these routes), `curl` against the route, and a Playwright
  script (`chromium.launch`, `deviceScaleFactor: 2`, 1280x900, `colorScheme` light and dark) that types a question,
  presses Enter, waits for Stop, then for the cost line.
- Results:
  - The stream carried `start`, `start-step`, `text-start`/`text-delta`x8/`text-end`, `tool-input-available`,
    `tool-output-available`, `finish-step`, a second step with 24 deltas, and `finish` with
    `messageMetadata {"costUsd":0.00432,"totalTokens":1072}`. The server logged the same cost from `onEnd`.
  - Invalid body (unknown part type, malformed JSON): 400 `ai_chat.invalid_input`.
  - Computed in the browser: theme-notion `--sft-color-background` `#fff` (light) / `#191919` (dark), accent fill and
    Send button `#0171cf`; theme-flat-paint `#f6f7f8` / `#0c0c0d`, accent fill and Send `#cff26b` (lime), font
    Ubuntu. No page errors and no failed requests in any of the four runs.
  - Screenshots: `notion-empty.png`, `notion-streaming.png`, `notion-light-answer.png`, `notion-dark-answer.png`,
    `notion-tool-card.png`, and the same five for `flat-paint-*`.

## Recommendation

**Integrate, in `llm` and `ui`, no new package for now.**

- Why: the spike shows the themes need nothing new, and the expensive gap (streaming without losing cost, metering,
  timeouts and error codes) belongs in `llm` whatever the UI choice. Leaving it to each app is exactly the
  inconsistency the issue describes. Documentation alone does not close it.
- Trade-offs: `llm` takes on AI SDK's streaming API, a surface that moves with every major (already its peer).
  ui gains a handful of components and copy. Keeping AI SDK types out of them keeps `ui` free of the dependency, at
  the price of a small mapping (`parts` to props) that apps copy from a recipe until a second consumer justifies a
  package.
- Not recommended now: shipping persistence or a "full chat" component (out of scope per the issue); `useObject` /
  `useCompletion` wrappers (no consumer yet; `generateStructured` covers the non-streamed case).

### Follow-up issue drafts (one per package)

1. **SOFTURE/AI, `@softure-ai/llm`: "llm: streamed chat with usage, cost and metering hooks"**: add `streamChat`
   (wrapping AI SDK `streamText`), keeping `createLlm`'s model, `timeoutMs`, `attributes`, `onUsage`, `onCall`,
   tracer and pricing. Total usage and cost come from `onEnd`. An abort settles the tokens already billed. It returns
   the `StreamTextResult` so routes call `toUIMessageStreamResponse()`. Also: a streaming fake model in
   `@softure-ai/llm/testing` (on `MockLanguageModelV4` + `simulateReadableStream`), and exports of `toLlmUsage` /
   `resolveCost` or an equivalent for routes. README: drop "Streaming is not offered" and document the chat route
   recipe.
2. **SOFTURE/AI, `@softure-ai/ui`: "ui: chat primitives on the --sft-* tokens"**: `ChatLog` (`role="log"`, polite
   announcements of finished messages, `aria-busy` while streaming), `ChatMessage` (per role), `ChatComposer`
   (textarea, Enter to send, send/stop/retry), `ToolCallCard` (pending, done, error states, around a child),
   `ReasoningDisclosure`, and empty and error states. The texts go in `uiMessages.en.chat`. No dependency on `ai`. The
   README gets the `useChat` mapping recipe and a tool-name to component registry pattern. Tests: axe and a
   screen-reader announcement check.
3. **SOFTURE/AI, `@softure-ai/theme-notion`: "theme-notion: chat primitives inside and outside PageFrame"**: decide
   whether the bridge should also apply outside `PageFrame` (for app screens on `--sft-*`) or document that a chat
   screen sits in a `PageFrame`; visual tests of the chat primitives.
4. **SOFTURE/AI, `@softure-ai/theme-flat-paint`: "theme-flat-paint: look maps for the chat primitives"**: class maps
   where flat-paint's look differs (lime only as paint, a second carrier for states, e.g. the user bubble as
   `surface-raised` plus a `line-strong` outline); visual tests in both schemes at 390 and 1440 px.
5. **SOFTURE/AI, `examples/next-app`: "example: AI chat route on llm.streamChat and ui's chat primitives"**: the
   e2e harness for the two issues above (streaming through the fake model, tool card, stop, retry, an invalid body
   rejected), once they are released.

### Proposal for the owner (not a decision)

A package `@softure-ai/ai-ui` makes sense only in its thin form: the `useChat` adapter (`parts` to ui props), the
typed tool-to-component registry and an optional `useChatRoute` helper. It would depend on `@softure-ai/ui` and
`@ai-sdk/react`, and follow AI SDK majors on its own release line, keeping `ui` free of that cadence. Proposed
trigger: build it when a second app (or a second framework adapter, e.g. Vue) needs the same mapping. Until then the
recipe in ui's README carries it.

## Unverified

- The AI SDK doc pages were not opened in this session (no network route to ai-sdk.dev). API claims come from the
  installed type declarations and the running spike.
- No real provider was called (no paid API by rule), so provider-reported cost (OpenRouter), real token timing and
  provider errors mid-stream were not exercised. The mock reported usage per step.
- No `next build` / production bundle analysis. The bundle size is an esbuild estimate.
- No screen-reader test of the live region. Mobile widths (390 px) were not screenshotted.
- Auth, rate limiting and persistence were reasoned about, not implemented in the spike.
