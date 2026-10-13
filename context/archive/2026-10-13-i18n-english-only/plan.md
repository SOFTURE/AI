---
change_id: i18n-english-only
status: archived
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

- [x] Phase 1: core i18n (`b2b88551`; `tests/i18n-english-only-446.test.ts` fails on master, where `selectMessages`,
  `pickLocalizedText` and `DEFAULT_LOCALE` do not exist; core 296 tests green after)
- [x] Phase 2: packages (`abda3942`; per package `vitest run` green: ui and charts 809, auth, billing, blog and
  feature-switches 1719, mailing and waitlist 711, the other modules and tools/config 693, deploy and marketing-kit 1261)
- [x] Phase 3: docs (`66a214db`)

Gates on the branch: `npm run typecheck` and `npm run lint` (ESLint and the language gate) green; the full `npm test`
runs in pre-push.
