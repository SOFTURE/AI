---
change_id: i18n-english-only
title: "all packages: English is the only built-in copy, apps supply other languages (issue #446)"
status: archived
roadmap_item: null
issue: 446
branch: claude/project-thread-9gzvh0
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #446](https://github.com/SOFTURE/AI/issues/446) (labels `enhancement`, `pkg: core`, `pkg: ui`,
`pkg: charts`): no package ships a second language. Every bundled `pl` dictionary goes, `Locale` becomes any BCP 47
tag, English is the only built-in dictionary and the fallback for every other locale, and an app that shows another
language passes its own translation through the `messages` overrides it already has.

A reviewer checks `foundation/core/tests/i18n-english-only-446.test.ts`, the module standard §6, the core README and
the CHANGELOG `Unreleased` entries.

## Context

Owner decision (2026-10-13): English only in the product, an app may plug in its own translation; breaking changes
accepted. Related in flight: #445 (core formatters take any locale tag, `formatDuration` copy leaves `coreMessages`)
and #435 (ui provider takes app messages); this change merges after them. Releases are batched by the coordinator:
no version bump, CHANGELOG `## Unreleased` entries only.

## Constraints

- Out of scope: Polish language data that is not copy (the blog's Polish quality ruleset under `rulesets/pl/`, the
  language gate's word list in `tools/config`).
- The override API keeps its shape: `module({ messages: { <locale>: DeepPartial<T> } })`.

## Process notes

- Framing: skipped. The owner set the rule and the issue names each ask.

## Decisions (auto)

- `Locale` stays exported, now `string` (a BCP 47 tag). `LOCALES` is removed; `DEFAULT_LOCALE = "en"` is added;
  `isLocale(value)` now means "a well-formed BCP 47 tag" (`Intl.getCanonicalLocales` accepts it).
- `Dictionaries<T>` is `{ en: T }` plus optional other locales; `MessageOverrides<T>` is partial dictionaries keyed
  by any tag. `mergeMessages` returns `en` plus every locale the defaults or overrides name, each built on the
  locale's own defaults or else on `en`, so a missing key reads English.
- New `selectMessages(dictionaries, locale)`: the exact tag, then its language (`pt-BR` → `pt`), then `en`. Every
  `dictionaries[locale]` read goes through it.
- Localized option texts (billing plans, waitlist and mcp-access, feature-switch labels, blog labels) accept any
  tag and read through one `pickLocalizedText` in core with the same fallback order.
- ui amount fields derive their notation from `Intl.NumberFormat` (decimal and group marks) instead of a per-locale
  table, keeping today's `en` and `pl` behaviour for those tags without Polish data in code.
- blog: `DEFAULT_OPEN_GRAPH_LOCALES` keeps `en` only, a tag with a region maps to `ll_RR`; the skill CLI names a
  language with `Intl.DisplayNames`.
- deploy and marketing-kit derive their locale lists from their dictionaries, now `["en"]`.
- The example app drops its `pl` dictionary and `APP_LOCALE`.
- marketing-kit gets `brand.messages` (every key optional) so a product films in its own language; `MARKETING_LOCALES`
  and `brand.language` go.
- deploy's release notes and report are English only (developer-facing output); `deploy-report.yml` takes `locale: en`.
- Tests that asserted Polish copy now pass an app translation (German ASCII words, locale `de`) and assert that a key
  it leaves out reads English; plural paths that only a non-English locale reaches use marker forms with `pl` rules.
