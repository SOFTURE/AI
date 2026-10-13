---
change_id: i18n-english-only
reviewed: 2026-10-13
verdict: approved
---

# Plan review: i18n-english-only

Checked plan.md against change.md, research.md, issue #446 and the sources.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | With `noUncheckedIndexedAccess`, an open `Dictionaries<T>` index is `T \| undefined`; direct `[locale]` reads stop compiling. | Intended: typecheck lists every read to route through `selectMessages`. |
| 2 | Warning | Language gate: test translations written to show the override path must not carry Polish diacritics or words. | Use German ASCII words in new tests; existing ASCII-only fixtures stay. |
| 3 | Warning | The ui amount parser accepted `.` and `,` as the decimal mark in `pl`; an `Intl`-derived table must keep that for locales whose group mark is a space. | Rule: a space-grouped locale accepts both marks; tests keep the `pl` cases. |
| 4 | Check | `isLocale` changes meaning (any tag); its only caller (waitlist) validates a stored or posted locale, which still works. | No change. |
| 5 | Check | The package template and `tests/repo/packages.test.ts` must agree, or every package fails the shape test. | Both change in phase 2. |

No Critical findings.
