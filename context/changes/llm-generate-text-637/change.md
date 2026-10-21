---
change_id: llm-generate-text-637
title: "llm: free-text generation next to generateStructured (issue #637)"
status: in_progress
roadmap_item: null
issue: 637
branch: claude/project-thread-d6papf
created: 2026-10-21
updated: 2026-10-21
---

## Intent

Close [issue #637](https://github.com/SOFTURE/AI/issues/637). `@softure-ai/llm` 0.1.1 offers only
`generateStructured`, so an app that wants a summary, a Markdown rewrite or a short title wraps the text in a
one-field schema, which costs tokens on the JSON envelope and hurts long Markdown output.

## Context

Labels: `enhancement`. Additive; releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`. Streaming stays out of scope.

## Acceptance

- `llm.generateText({ system?, prompt, maxOutputTokens?, maxChars?, timeoutMs?, model?, attributes? })` returns
  `Result<{ text, usage, model, costUsd, truncated }, LlmErrorCode>` with the same time limit, retries, usage record,
  cost and span handling as `generateStructured`.
- A model that stops on the token limit yields the new code `llm.output_truncated` (usage still recorded), for both
  `generateText` and `generateStructured`.
- `maxOutputTokens` is passed to the model; `maxChars` cuts the trimmed text and sets `truncated: true`.
- An empty answer (only whitespace) is `llm.invalid_output`.
- Each operation has its own span name (`llm.generate_text`, `llm.generate_structured`).
- `fakeModel` can answer with a token-limit stop, and its `text` response serves `generateText`.
- README and CHANGELOG `## Unreleased` describe the new call and code.

## Notes

- Framing: skipped. The issue states the gap and the requested contract.

## Decisions (auto)

- A token-limit stop is an error (`llm.output_truncated`), not a partial success: a cut summary or Markdown block is
  rarely usable as is, and the issue names the code. Usage is recorded, since the tokens were spent.
- `maxOutputTokens` is added to `generateStructured` too, so both calls keep one contract, and a structured call cut
  by the limit reports `llm.output_truncated` instead of `llm.invalid_output`.
- The text is trimmed of surrounding whitespace; `maxChars` then cuts at the last whitespace inside the limit (hard cut
  when there is none) so a title or summary does not end mid-word. `truncated` says whether `maxChars` cut it.
- Whitespace-only text is `llm.invalid_output`: there is nothing the app could show.
- A new response kind `{ kind: "truncated", text? }` in `fakeModel` provokes the token-limit stop.
