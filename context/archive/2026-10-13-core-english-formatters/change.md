---
change_id: core-english-formatters
title: "core: English formatters by default and app-supplied translations (issue #438)"
status: implemented
roadmap_item: null
issue: 438
branch: claude/project-thread-6nwt0b
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #438](https://github.com/SOFTURE/AI/issues/438) (labels `enhancement`, `pkg: core`): the formatters added in
#410 (core 0.1.11) build one non-English grammar into core. The building blocks are English-first.

1. Remove the language-specific `genitive` style of `formatCalendarMonth`.
2. `formatDuration` uses built-in English copy, independent of core's dictionaries.
3. An app can plug in its own translation: the `Intl`-based formatters and `selectPlural` take any BCP 47 locale tag,
   and `formatDuration` takes `{ locale, messages }`.
4. Docs and README examples in English terms.

A reviewer checks `foundation/core/tests/core-english-formatters-438.test.ts`, the README and the CHANGELOG `Unreleased`
entry.

## Context

core 0.1.11 is on master and npm. Releases are batched by the coordinator: no version bump, the CHANGELOG
`## Unreleased` section gets the entries. Breaking changes are accepted by the owner and are listed in the entry.

## Constraints

- No package outside core calls `formatCalendarMonth` or `formatDuration` (checked with grep), so nothing else moves.
- `LOCALES`, `Locale` and the module dictionaries are untouched: dropping a built-in locale from every module is a
  separate, repository-wide change.
- Widening a parameter from `Locale` to `string` is source compatible for every existing caller.

## Process notes

- Framing: skipped. The owner set the rule (English only, an option for an app's own translation) and the issue names
  each gap.

## Decisions (auto)

- `formatDuration(months, options?)` with `FormatDurationOptions { locale?: string; messages?: DurationMessages }`;
  defaults `"en"` and `DEFAULT_DURATION_MESSAGES`. `locale` picks the plural rules, `messages` the words. An options
  object over a positional locale so a missing `messages` cannot silently pair one language's words with another's
  rules in a hard-to-read call.
- `DurationMessages` is `{ years: PluralForms; months: PluralForms; both: string }`, placeholders `{count}`,
  `{years}`, `{months}`.
- The `duration` group leaves `coreMessages` (en and pl): its copy is now a formatter default, not module copy.
- `CalendarMonthStyle` is `"long" | "roman"`; a full date's month form stays available through `formatCalendarDay`.
- `formatCalendarDay`, `formatCalendarMonth`, `formatMoney`, `formatPercent` and `selectPlural` take `locale: string`;
  an invalid tag throws `Intl`'s `RangeError`, documented.
