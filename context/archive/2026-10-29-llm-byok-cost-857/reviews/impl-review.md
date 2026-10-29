---
change_id: llm-byok-cost-857
verdict: approved
---

# Implementation review

- Plan conformance: both phases done as planned (4c3182e, 9a33ae3).
- Correctness: `readProviderCostUsd` sums the usable parts (fee, upstream) and returns `null` only when neither is
  usable; `resolveCost` gives a positive provider figure first, then the price table, then `0 / "provider"` for an
  unpriced model that reported 0. The #805 tests pass unchanged (a positive cost, unusable values, an unpriced 0).
- Tests: 6 new in `tests/byok-cost-857.test.ts` (4 failed before the fix). Gates: typecheck, ESLint, llm tests
  (68) green.
- Docs: README "Usage and cost" and the fake model example; CHANGELOG `Unreleased` with the migration for an app
  that worked around the bug.
