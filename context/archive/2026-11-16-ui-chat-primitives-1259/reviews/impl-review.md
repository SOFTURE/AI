---
change_id: ui-chat-primitives-1259
verdict: approved
---

# Implementation review

Reviewed the branch (b1ca35f, ae1a0b5) against plan.md and change.md.

- Drift: `ChatLog` wraps its `<ol>` in a `div role="log"` (axe refuses `role="log"` on a list); recorded in the plan.
  Slots `root`, `log`, `list`, `announcer`.
- Ask 1: all seven components exist with slots, `unstyled`, `data-role` / `data-status` on messages and `data-state`
  on the tool card (the theme threads' asks).
- Ask 2: copy group `chat` in `uiMessages.en`, overridable per component and through `UiLocaleProvider` (tests for
  both); `foundation/ui/package.json` gains no runtime dependency (only the devDependency `axe-core`).
- Ask 3: README "Chat" section with the `useChat` mapping and the typed tool registry; type names checked against
  `ai` 7.0.163's `index.d.ts` (`ToolUIPart` states, `TextUIPart` / `ReasoningUIPart` `state`). `@ai-sdk/react` is not
  installed in the repository, so the hook's options in the recipe stay to `transport` only.
- Ask 4: axe finds no violations in a full chat while streaming, ready and on error, and in the empty state; the
  announcement appears in the polite atomic status only after streaming ends, and the log stays `aria-live="off"`.
- Security: text renders as React text (a test with an `<img onerror>` string finds no element).
- Evidence: `npx vitest run foundation/ui` 51 files, 680 tests passed; `npm run typecheck`, ESLint on
  `foundation/ui`, `npm run lint:language` clean; `npm run build` passed, `styles.css` 7.4 kB gzip (budget 20 kB);
  the compiled sheet holds the new variants (`in-data-[role=user]`, `data-[state=error]`, `animate-typing`).
  A static render with the built CSS was screenshotted in light and dark (Chromium, 800 px) and looked as intended.

Verdict: approved, no findings.
