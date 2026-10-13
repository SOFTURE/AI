---
change_id: i18n-english-only
status: planned
---

# Plan: English-only built-in copy (issue #446)

Input: change.md, research.md. Complexity: large (every package, mechanical after core).

## Phase 1: core i18n (TDD)

Files: `foundation/core/src/{i18n,config,index}.ts`, `messages/`; test `tests/i18n-english-only-446.test.ts`.

1. Tests first: `selectMessages` exact tag, language fallback, `en` fallback; `mergeMessages` with an override for a
   locale the defaults lack; `config.locale` accepts `de-AT` and refuses `not a tag`; `isLocale`; `pickLocalizedText`;
   `coreMessages` has `en` only.
2. Implement; adapt existing core tests that named `pl`.

## Phase 2: packages

Remove every `messages/pl.ts`, route every locale read through `selectMessages` / `pickLocalizedText`, open the
localized text schemas, ui amount notation from `Intl`, blog Open Graph and language names, deploy and marketing-kit
lists, example app, package template, `tests/repo/packages.test.ts` (only `en.ts` required, no `pl.ts` allowed).
Tests that exercised `pl` copy either drop it or pass an app translation.

## Phase 3: docs

Module standard §6, core README (localization), ui and charts README, a CHANGELOG `## Unreleased` entry in every
package touched, with the migration (pass `messages: { pl: {...} }`).

## Progress

- [ ] Phase 1: core i18n
- [ ] Phase 2: packages
- [ ] Phase 3: docs
