---
change_id: llm-generate-text-637
status: done
verdict: approved
---

# Implementation review: llm-generate-text-637

- Acceptance met: `generateText` with `system`, `prompt`, `maxOutputTokens`, `maxChars`, `timeoutMs`, `model`,
  `attributes`; result `{ text, truncated, usage, model, costUsd }`; `llm.output_truncated` for both calls with usage
  recorded; empty text is `llm.invalid_output`; span `llm.generate_text`; fake `truncated` response; README and
  CHANGELOG `## Unreleased`.
- One call path: timer, abort, late-rejection handling, span, usage record and cost are shared by both calls, so the
  existing structured tests (timeout, ignored abort, timer cleared, propagation of foreign errors) cover the text path.
- Edge cases tested: `maxChars` at a word boundary, inside a word, without whitespace, exactly at the limit, over
  astral characters; whitespace-only answer; invalid `maxChars` / `maxOutputTokens` / `timeoutMs` reject before the
  model is called; text calls send no response format.
- Spans hold neither the prompt nor the text (test).
- Gates: typecheck, lint and language green in the hooks; 51 llm tests pass; the package builds; `npm test` runs in
  the pre-push hook.

Verdict: approved, no changes.
