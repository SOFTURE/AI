---
change_id: core-english-formatters
status: planned
---

# Plan: core English formatters (issue #438)

Input: change.md, research.md. Complexity: small (one package, one test file, docs).

## Phase 1: formatters (TDD)

Files: `foundation/core/src/format.ts`, `i18n.ts`, `messages/{en,pl}.ts`, `index.ts`; tests
`foundation/core/tests/core-english-formatters-438.test.ts`, `core-formatters-410.test.ts`.

1. Tests first, red on master:
   - `formatDuration(38)` is `3 years and 2 months`, `formatDuration(0)` is `0 months`;
   - `formatDuration(n, { locale, messages })` uses the app's words and the locale's plural rules (a German set:
     `1 Jahr und 1 Monat`, `2 Jahre`, `5 Monate`), and a locale alone keeps the English words;
   - `formatCalendarMonth`, `formatCalendarDay`, `formatMoney`, `formatPercent` accept a tag outside `LOCALES`
     (`de`) and write it as `Intl` does; an invalid tag throws `RangeError`;
   - `selectPlural("de", ...)` works; `coreMessages.en` has no `duration` group;
   - `formatCalendarMonth` has no `genitive` style (type-level: `@ts-expect-error`).
2. Remove the Polish cases of the #410 test file that exercised the removed behaviour.
3. Implement and export `FormatDurationOptions`, `DurationMessages`, `DEFAULT_DURATION_MESSAGES`.

## Phase 2: docs

`foundation/core/README.md` (formatting section, plural rules), `foundation/core/CHANGELOG.md` (`## Unreleased`,
breaking changes first).

## Progress

- [ ] Phase 1: formatters
- [ ] Phase 2: docs
