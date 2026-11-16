---
change_id: ui-chat-primitives-1259
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (8dd9591).

- Ask 1 (components): Phase 1 covers `ChatLog`, `ChatMessage`, `ChatComposer`, `ToolCallCard`, `ReasoningDisclosure`,
  and empty and error states.
- Ask 2 (copy in `uiMessages.en.chat`, no `ai` dependency): Phase 1; the status union is a plain string type.
- Ask 3 (README recipe and registry): Phase 2.
- Ask 4 (axe and live region): Phase 1 tests; `axe-core` declared as ui's devDependency (lockfile change limited to
  ui's workspace entry).
- Theme threads: slot types exported, `data-role` and `data-state` present, as #1260 / #1261 asked.
- Risk: `aria-live="off"` on a `role="log"` overrides its implicit politeness on purpose; the separate status region
  carries the announcement. Covered by a test.
- Risk: IME composition (`isComposing`) under happy-dom: the test sets `nativeEvent.isComposing` through
  `fireEvent.keyDown(..., { isComposing: true })`.

Verdict: approved, no changes.
