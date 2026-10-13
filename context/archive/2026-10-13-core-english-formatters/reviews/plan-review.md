---
change_id: core-english-formatters
reviewed: 2026-10-13
verdict: approved
---

# Plan review: core-english-formatters

Checked plan.md against change.md, research.md, issue #438 and the core sources.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | The language gate scans tests: non-English expected strings with diacritics fail `lint:language`. | German examples use only ASCII words (`Jahr`, `Jahre`, `Monat`, `Monate`, `und`). |
| 2 | Warning | `formatDuration`'s English default must not use `few` / `many`: with another locale's rules and no `messages`, those categories must fall back to `other`. | `DEFAULT_DURATION_MESSAGES` has `one` and `other` only; a test covers a locale alone. |
| 3 | Check | Widening `locale` to `string` in `selectPlural` keeps the auth and billing callers compiling. | No change; typecheck covers it. |
| 4 | Check | The `Intl` caches key on the locale string; any tag the app passes adds one entry, bounded by the app's own set of locales. | No change. |

No Critical findings.
