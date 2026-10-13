---
change_id: core-english-formatters
reviewed: 2026-10-13
verdict: approved
---

# Implementation review: core-english-formatters

Checked the diff against change.md, plan.md and issue #438.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Every ask of #438 is covered: no `genitive` style, English defaults in `DEFAULT_DURATION_MESSAGES`, `formatDuration(months, { locale, messages })`, any BCP 47 tag in the four `Intl` formatters and `selectPlural`, English docs. | No change. |
| 2 | Check | `selectPlural` callers in auth and billing pass a `Locale`, still valid under `string`; typecheck is green over the whole tree. | No change. |
| 3 | Check | With a locale alone, categories the English forms lack (`few`, `many`) fall back to `other`; covered by a test with `pl` rules. | No change. |
| 4 | Suggestion | `DEFAULT_DURATION_MESSAGES` sat between two unrelated constants without a blank line. | Fixed in the review commit. |
| 5 | Check | The CHANGELOG `Unreleased` entry lists the three breaking changes first, with the migration of `formatDuration(n, "en")`. No version bump (batched releases). | No change. |

Out of scope, left for the coordinator: `LOCALES` still holds a second built-in locale and every module ships its
dictionary; removing it is a repository-wide change of its own.
