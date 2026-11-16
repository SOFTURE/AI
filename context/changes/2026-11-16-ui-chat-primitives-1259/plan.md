---
change_id: ui-chat-primitives-1259
status: planned
---

# Plan: ui chat primitives (issue #1259)

Input: change.md, research.md. Complexity: medium (one package, docs).

## Phase 1: components and copy (TDD)

Files: `foundation/ui/src/ui/chat.tsx`, `src/ui/index.ts`, `src/messages/en.ts`, `foundation/ui/package.json`
(devDependency `axe-core`), `tests/chat-1259.test.tsx`.

- `ChatLog` (`root`, `list`, `announcer`): `<ol role="log" aria-label aria-live="off" aria-busy>` around
  `ChatMessage` items, plus a visually hidden `role="status"` polite atomic region that holds `announcement` only
  when `isStreaming` is false.
- `ChatMessage` (`root`, `label`, `bubble`, `typing`, `meta`, `actions`): `<li data-role data-status>`, the role's
  name from copy (or `name`), a typing indicator while streaming with no content, optional `meta` and `actions`.
  Roles `user | assistant | system`; status `streaming | done | error`.
- `ChatComposer` (`root`, `label`, `input`, `actions`, `send`, `stop`, `retry`): a form with a labelled textarea,
  controlled (`value`, `onValueChange`) or not; `onSend(text)` on Enter or Send with trimmed non-empty text, cleared
  after send when uncontrolled; Stop instead of Send while `submitted` / `streaming` (when `onStop`); Retry when
  `error` (when `onRetry`); `disabled`.
- `ToolCallCard` (`root`, `header`, `title`, `status`, `body`, `error`): `data-state="pending | done | error"`,
  `aria-busy` while pending, the state's text from copy, `children` (the validated output) shown when done, the
  error text when error.
- `ReasoningDisclosure` (`root`, `summary`, `content`): native `<details>`, summary "Reasoning" or "Thinking…"
  while streaming.
- `ChatEmptyState` (`root`, `title`, `description`, `suggestions`, `suggestion`) on prompt suggestions with
  `onSuggestion`, `ChatError` (`root`, `message`, `retry`) with `role="alert"` and an optional Retry.
- Tests: roles and names, the announcement appears only after streaming ends, Enter / Shift+Enter / IME, Send ↔ Stop
  ↔ Retry, controlled and uncontrolled, tool states and `data-state`, copy overrides through the provider and props,
  `classNames` / `unstyled`, and axe with no violations on a full chat in each state.

## Phase 2: docs

ui README (a chat section: components table, the `useChat` mapping recipe, the tool registry pattern with validated
output only), ui `CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- One file `chat.tsx`: the components share copy and small helpers; each still exports its own slot type.
- The announcement text comes from the app (`announcement`), since children are nodes and the log cannot know their
  plain text.
- `ChatEmptyState` composes the existing `EmptyState` look rather than adding a new primitive.
- No version bump: the coordinator releases the batch.

## Progress

- [ ] Phase 1: components and copy
- [ ] Phase 2: docs
- [ ] Implementation review
