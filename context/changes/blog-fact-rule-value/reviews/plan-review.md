---
change_id: blog-fact-rule-value
reviewed: 2026-10-12
verdict: approved
---

# Plan review: blog-fact-rule-value

Checked plan.md against change.md, research.md, issue #379, `src/quality/facts.ts`, `src/quality/rules/facts.ts`,
`src/quality/refresh.ts` and `tests/adoption-gaps-318.test.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | An app's pattern may carry a `g` or `y` flag; calling `exec` on it would move `lastIndex` and make later matches skip text. | Accepted: decision 1 runs a copy without `g`/`y`. |
| 2 | Warning | The unknown-year warning shares the rule id, so `quality.severity[id] = "error"` would also promote it. | Accepted and documented: one id per rule keeps the catalog and the writing skill simple; "off" silences both. |
| 3 | Check | Checking every year changes no passing sentence into a failing one, so existing texts stay green. | No change. |
| 4 | Check | The #318 tests pin today's reading without groups; they stay unchanged. | No change. |

No Critical findings. Framing skip is justified in change.md.
