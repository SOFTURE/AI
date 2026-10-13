---
change_id: core-percent-fraction-digits
reviewed: 2026-10-13
verdict: approved
---

# Plan review: core-percent-fraction-digits

Checked plan.md against change.md, research.md, issue #455 and the core sources.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | PR #445 adds a `## Unreleased` CHANGELOG section too; whichever merges second resolves a conflict there. | Phase 2 adds to `## Unreleased`; merge master in before READY and keep both entries. |
| 2 | Check | The zero rule is `Intl`'s (`signDisplay` `negative`/`exceptZero` apply after rounding), measured on Node 22; the tests pin it so an engine change shows up. | No change. |
| 3 | Check | The pl assertions use plain ASCII output (`19,00%`), so the language gate is not affected. | No change. |
| 4 | Check | The formatter cache key includes the digit options, so precisions do not share a formatter. | No change. |

No Critical findings.
