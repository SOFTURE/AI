---
change_id: theme-notion-copy-button
title: "theme-notion: CopyButton, one value to the clipboard"
status: archived
archived_at: 2026-11-17
roadmap_item: null
issue: null
branch: claude/project-thread-6s0opx
created: 2026-11-17
updated: 2026-11-17
---

## Intent

Give apps one shared way to copy a value (a connector URL, a command, a sample prompt) to the clipboard: a button that
confirms the copy in words and is read by a screen reader. An adopting app's onboarding needs it for its connector URL
and its first question; mcp-access's token manager has its own copy logic inline.

## Context

`@softure-ai/theme-notion` 0.23.0 has `Code` and `CodeBlock` but no copy action. The owner's standing order for the
adopting app: every new UI component goes into the Notion design system kit right away, so apps share it.

## Scope

- `CopyButton` in `src/notion/CopyButton.tsx` (client component), exported with `COPY_BUTTON_RESET_MS`.
- Message `copy: { copy, copied }` in `notionMessages.en`; props `label`, `copiedLabel`.
- Tests, gallery case, parity fixture, inline gallery baselines, README, CHANGELOG; release 0.24.0 (minor).

## Constraints

- No existing component changes; no raw colours (a `Button` variant).

## Notes

- Research and frame skipped: one small additive composition over `Button`, the shape taken from mcp-access's token
  manager copy button and the adopting app's need.

## Decisions (auto)

- A button, not a `CodeBlock` option: the app composes it beside any value (a code block, an input, a link), and the
  code block stays a plain `<pre>` on the server.
- The visible word changes ("Copy" → "Copied") inside an `aria-live="polite"` span, so the confirmation is both seen
  and heard; the value is never part of the name.
- A refused clipboard write keeps the button as it was: the value beside it stays selectable by hand.
