---
change_id: mcp-access-strict-tool-input-876
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (2d39061).

- Acceptance of #876: unknown fields at every level with the field and accepted fields named, `input.field_renamed`,
  text scalars with the listing unchanged, applied once at registration: all in phase 1, each with a test through the
  SDK's real `tools/call` path, so "refused before the handler runs" is measured, not assumed.
- Compatibility: opt-in wrapper and factory option; the tool-list version changes only for servers that opt in, which
  is right since their listing changes (`additionalProperties: false`).
- Risks: cloning drops `.describe()` metadata (copied, tested); refinements on objects survive clone (tested); recursive
  `z.lazy` schemas need memoization (cache per original schema). Unions reporting the closest branch is zod's behaviour
  and is covered by a test.
- The "only the input side of a transform" rule is honoured by rewriting `pipe.in` (or `out` after a preprocess).

Verdict: approved.
