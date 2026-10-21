---
change_id: llm-generate-text-637
status: done
verdict: approved
---

# Plan review: llm-generate-text-637

- Scope matches the issue: `system`, `prompt`, `maxOutputTokens`, `attributes`, the same timeouts, codes, usage,
  cost and spans, `maxChars`, fake model support; streaming stays out.
- One shared call path keeps the timeout and unhandled-rejection handling in one place instead of copying it.
- The new code is additive at runtime; the type-level break for exhaustive switches is called out for the CHANGELOG.
- Tests cover success, empty, boundary (`maxChars` exact length, no whitespace) and every failure code.
- Span names differ per operation so traces tell the two calls apart; the prompt and text stay out of spans.

Verdict: approved, no changes.
