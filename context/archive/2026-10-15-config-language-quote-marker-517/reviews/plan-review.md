---
change_id: config-language-quote-marker-517
reviewed: 2026-10-15
verdict: approved
---

# Plan review: config-language-quote-marker-517

Checked plan.md against change.md, research.md, issue #517 and `language/index.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | A diacritic inside a code span is a hit today; dropping code spans before the diacritic check would loosen the gate. | Taken: the diacritic check keeps code spans outside a marked region, as today. |
| 2 | Warning | An unclosed marker at the end of a file would exempt everything after it. | Taken: reported as a hit on the opening line. |
| 3 | Check | The README must show the marker without opening a region in this repository's own gate. | Taken: shown in a fenced block with both markers, so the region closes. |
| 4 | Check | The marker regex runs per text token; no backtracking risk with a bounded pattern. | No change. |

No Critical findings.
