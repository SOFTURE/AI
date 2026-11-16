---
change_id: ui-chat-primitives-1259
title: "ui: chat primitives on the --sft-* tokens (issue #1259)"
status: planned
roadmap_item: null
issue: 1259
branch: claude/project-thread-ghozv0
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Close [issue #1259](https://github.com/SOFTURE/AI/issues/1259): give every app on `@softure-ai/ui` the building
blocks of a chat screen (message log, message per role, composer with send / stop / retry, tool call card, reasoning
disclosure, empty and error states) on the `--sft-*` tokens, accessible by default, so that apps stop building chat
screens by hand and every theme that bridges `--sft-*` styles them with no per-theme code.

## Context

Labels: `enhancement`, `pkg: ui`. Follow-up of the concept check #1248
(`context/archive/2026-11-16-ai-sdk-ui-concept-check/research.md`, recommendation A). Package: `foundation/ui` 0.3.7.
Parallel work: #1258 (`llm` streaming), #1260 (theme-notion), #1261 (theme-flat-paint look maps). The two theme
threads build on this change's slots and asked for exported slot types, `data-role` on a message and `data-state` on
the tool card root. No version bump: the coordinator releases the batch.

## Scope

- Components in `foundation/ui/src/ui/chat.tsx` (client): `ChatLog`, `ChatMessage`, `ChatComposer`, `ToolCallCard`,
  `ReasoningDisclosure`, `ChatEmptyState`, `ChatError`, each with `classNames` slots and `unstyled`.
- Copy in `uiMessages.en.chat`, overridable through `messages` and `UiLocaleProvider`.
- README: the `useChat` mapping recipe (message parts to props) and the tool-name to component registry pattern.
- Tests: axe (`axe-core`) on a full chat and the live-region announcement.

## Constraints

- No dependency on `ai` or `@ai-sdk/*`: the components take plain props.
- No raw HTML: parts render as React text or as the app's validated components.
- Colours from `--sft-*` tokens only; ui's `styles.css` stays inside its 20 kB gzip budget.
- Existing components and exports unchanged.

## Notes

- Framing: skipped. The concept check #1248 already framed the problem and chose this option.
