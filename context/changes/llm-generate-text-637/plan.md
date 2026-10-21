---
change_id: llm-generate-text-637
status: in_progress
---

# Plan: generateText in @softure-ai/llm (issue #637)

Input: change.md, research.md. Complexity: small (one module refactor, tests, docs).

## Goal

An app asks the model for plain text (a summary, Markdown, a title) with the same guarantees as structured output.

## Approach

Generalise the shared call path: `runCall` takes the operation (span name, AI SDK options, how to read the answer) and
does the timer, the span, the usage record and the `Result`. `generateStructured` and `generateText` are thin
wrappers. Rejected: a one-field schema behind `generateText` (the cost the issue wants to avoid); a partial success
on a token-limit stop (decided in change.md).

## Phase 1: generateText, truncation code, fake model, tests

Files: `foundation/llm/src/contract.ts`, `src/create-llm.ts`, `src/tracing.ts`, `src/index.ts`,
`src/testing/index.ts`, `tests/generate-text.test.ts`, `tests/generate-structured.test.ts`, `tests/tracing.test.ts`,
`tests/fake-model.test.ts`.

1. `contract.ts`: add `llm.output_truncated` to `LLM_ERROR_CODES`; add `TextResult`.
2. `tracing.ts`: `startCallSpan(tracer, name, request)`; export both span names.
3. `create-llm.ts`: `TextRequest`, `maxOutputTokens` on both requests (validated: a positive integer), `maxChars`
   (a positive integer), the shared `runCall`, `finishReason === "length"` → `llm.output_truncated`.
4. `fakeModel`: `{ kind: "truncated", text?, usage? }` answers with `finishReason: "length"`.
5. Tests: text result, system/prompt/no response format sent, `maxOutputTokens` sent, `maxChars` cut at whitespace and
   hard cut, trimming, empty answer, truncation for both calls, unavailable, timeout, span name and attributes,
   invalid options throw.

## Phase 2: docs

Files: `foundation/llm/README.md`, `foundation/llm/CHANGELOG.md`, `package.json` description.

## Risks and rollback

An app that switches exhaustively over `LlmErrorCode` gets a type error for the new code: intended, noted in the
CHANGELOG. Revert the commits to roll back.

## Progress

- [x] Phase 1: generateText, truncation code, fake model, tests (shared `runCall`, `llm.output_truncated` for both calls, `maxOutputTokens`, `maxChars`, fake `truncated` response; 51 llm tests green)
- [x] Phase 2: docs (README call, error and fake-model tables, CHANGELOG `## Unreleased`, package description)
