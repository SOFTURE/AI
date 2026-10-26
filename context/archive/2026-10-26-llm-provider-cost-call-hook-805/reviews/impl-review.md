---
change_id: llm-provider-cost-call-hook-805
verdict: approved
---

# Implementation review

Reviewed the diff of `contract.ts`, `usage.ts`, `create-llm.ts`, `tracing.ts`, `testing/index.ts`, `index.ts`, the
new test file, the adjusted tests, README and CHANGELOG against plan.md.

- Every plan step is done. Phases 1 and 2 landed in one commit: the new test file covers both.
- Finding (fixed in 66848cb): `onCall`'s `durationMs` was read after `onUsage` was awaited, so a slow `onUsage` added to
  it. The duration is now measured once when the call ends; a test pins it.
- Compatibility: without a provider cost every value is as before; the only addition to existing records and results
  is `costSource`. Tests that compare whole records were extended, not loosened.
- Provider cost: a string, negative or NaN cost, and metadata of another provider fall back to the price table.
  A structured `llm.invalid_output` thrown by the SDK carries no provider metadata, so it is priced from the table.
- Hooks: `onCall` runs for every outcome, after `onUsage`; a throw propagates (pinned for an answer and a timeout).
- Gates: typecheck, ESLint and the language gate green on commit; package tests 62 of 62.

Verdict: approved after the fix.
