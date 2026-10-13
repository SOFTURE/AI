---
change_id: i18n-english-only
---

# Research: English-only built-in copy (issue #446)

## Current state (master `fd5e933`)

- `foundation/core/src/i18n.ts`: `LOCALES = ["en", "pl"]`, `Locale` is their union, `Dictionaries<T>` a complete
  `Record<Locale, T>`, `MessageOverrides<T>` partial per locale, `mergeMessages` loops over `LOCALES`.
- `config.ts`: `locale: z.enum(LOCALES)`.
- `messages/pl.ts` in core, ui, charts, 14 modules, deploy, marketing-kit, the package template and the example app.
- 48 reads index a dictionary or a localized text by locale (`grep "\[locale\]\|\[config.locale\]"`), most through
  `getXModule(config).messages[config.locale]`.
- Localized option texts: `z.partialRecord(z.enum(LOCALES), …)` in billing, waitlist, mcp-access and
  feature-switches; three `getLocalizedText` copies (`text[locale] ?? text.en ?? ""`); blog reads labels the same way.
- `foundation/ui/src/ui/amount.ts`: four `Record<Locale, …>` tables for the amount notation.
- `modules/blog`: `DEFAULT_OPEN_GRAPH_LOCALES { en, pl }`, skill CLI `LANGUAGE_NAMES { en, pl }`.
- `tests/repo/packages.test.ts`: a package with `messages/` must have `en.ts` and `pl.ts` with the same keys.
- `tools/deploy`, `tools/marketing-kit`: own locale lists from `Object.keys` of their dictionaries.

## Options

1. Keep `LOCALES = ["en", "pl"]` with `pl` a copy of `en`: still a Polish dependency, no other language. Rejected.
2. `LOCALES = ["en"]`: an app cannot name any other locale at all. Rejected.
3. Open `Locale` to any BCP 47 tag, `en` built in, overrides per tag. Chosen: the override API keeps its shape, and
   an app with a full translation passes it as overrides for its locale.

## Risks

- Breaking for apps that set `locale: "pl"` without overrides: they now get English. Documented in each CHANGELOG
  with the migration.
- Conflicts with #445 (core i18n, messages) and #435 (ui copy, charts messages): merge master after they land.
