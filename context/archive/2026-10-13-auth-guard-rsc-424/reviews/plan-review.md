---
change_id: auth-guard-rsc-424
reviewed: 2026-10-13
verdict: approved
---

# Plan review: auth-guard-rsc-424

Checked plan.md against change.md, research.md, issue #424 and the files it touches.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | A segment `_rsc` with no `=` (bare key) must be dropped too; split the name on the first `=` only. | Taken into Phase 1 tests. |
| 2 | Warning | `+` in a name decodes to a space in form encoding; `decodeURIComponent` keeps it, which is fine for `_rsc`, but the helper must not throw on `%` sequences (`%E0`). | Taken: undecodable names are kept (tested). |
| 3 | Check | The helper is a pure read named with a verb (`get*`), no side effects. | No change. |
| 4 | Check | Guarding decisions and origin resolution are untouched; existing tests pin them. | No change. |

No Critical findings.
