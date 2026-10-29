---
change_id: llm-byok-cost-857
verdict: approved
---

# Plan review

- Coverage: both expectations of the issue map to steps: the summed provider cost (P1.1) and 0 as "not reported"
  when a price exists (P1.2). Tests start red (P1.3).
- Compatibility: no exported signature changes; a call that reported a positive `usage.cost` keeps its value unless
  an upstream cost is added. An app that read `costUsd: 0, costSource: "provider"` for a priced model now gets the
  price table's estimate, which is the fix. No dependent workspace package.
- Edge cases: unpriced free models keep 0; NaN/negative/string parts are skipped; both parts missing → `null`.
  Approved.
