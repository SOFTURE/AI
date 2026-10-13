---
change_id: i18n-english-only
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: i18n-english-only

Checked the diff against change.md, plan.md and issue #446.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every ask of #446: no `messages/pl.ts` left (`tests/repo/packages.test.ts` now allows `en.ts` only), `Locale` is any tag, overrides take any locale, localized option texts accept any tag, docs and changelogs describe the migration. | No change. |
| 2 | Check | Every `module.messages[locale]` read goes through `selectMessages` (grep finds none left in `src/`), so a locale the app did not translate reads English instead of `undefined`. | No change. |
| 3 | Warning | The marketing-kit schema test requires a description on every key; `brand.messages` keys had none. | Fixed: each key describes its `en.ts` path; `schema/marketing.schema.json` regenerated. |
| 4 | Suggestion | deploy's CLI usage still listed `--locale=en\|pl`. | Fixed. |
| 5 | Check | ui amount notation from `Intl`: `en` and `pl` keep their accepted inputs (existing tests unchanged), `de` and `fr` now work. | No change. |
| 6 | Check | One ui test (Card and Field hint names under a provider) can no longer observe the provider's locale, since English is the only copy; it still checks the labels render. | Accepted. |

Out of scope, unchanged: the blog's Polish quality ruleset and the language gate's word list (language data, not copy).
