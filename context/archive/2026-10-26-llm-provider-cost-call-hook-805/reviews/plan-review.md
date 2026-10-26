---
change_id: llm-provider-cost-call-hook-805
verdict: approved
---

# Plan review

Reviewed against change.md, research.md, `create-llm.ts`, `usage.ts`, `contract.ts`, `testing/index.ts` and the tests.

- Scope: both asks of the issue (provider cost with `costSource`; a hook for every finished call with code and
  duration). Only the `llm` package.
- Compatibility: new fields and an optional hook. `costUsd` changes value only when the provider reports a cost, which
  is the figure the issue asks for. Existing tests that compare whole records gain `costSource`.
- Edge cases: missing, malformed and negative provider cost; a model without a price; timeouts and provider failures
  without usage; a throwing hook.
- Naming is aligned with #804 where the concepts match, and the deviation (propagating hook failure) is reasoned.

Verdict: approved, no changes.
