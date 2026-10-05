# Plan: testing-playwright-helpers

Input: change.md, research.md. Complexity: medium (two phases).

## Goal

`@softure-ai/testing/playwright` exports the generic helpers, tested against a real browser; the example
app's e2e uses them instead of its per-spec copies and stays green.

**Out of scope:** module factories (auth account in SQL: a gap), FIRE-specific screens, publishing
(DP-8), Playwright config presets.

## Approach

**Chosen:** one entry `./playwright` with small files under `src/playwright/` (`client-address.ts`,
`auth.ts`, `test-data.ts`, `wait-for.ts`, `select.ts`, `links.ts`, `assertions.ts`, `index.ts`).
Auth helpers take auth's copy as a structural `AuthFormCopy` (`authMessages.en` fits), so the package
needs no dependency on a module. Options objects for every helper with more than three inputs.

**Rejected:** a Playwright fixture (`test.extend`) as the main API: it couples the helpers to one
fixture set and hides the calls; apps can wrap the functions in their own fixtures. Typed factories per
table here: research (FIRE dropped them; the module owns its schema).

## Phase 1: Helpers and their tests

**Discipline:** TDD; browser tests skip without a Chromium, fail on a configured missing path.
**Files:** `foundation/testing/src/playwright/**`, `foundation/testing/tests/playwright-*.test.ts`,
`foundation/testing/package.json` (export, optional peer, dev dependency), `package-lock.json`, README.

1. Pure tests: `randomClientAddress` inside 198.18.0.0/15, `uniqueName`/`uniqueEmail` distinct,
   `waitFor` returns the value, retries through errors, times out naming the description and the cause,
   `withDatabase` closes on success and on failure.
2. Browser tests on `page.setContent`/a local HTTP server: `registerAccount`/`logIn` against a minimal
   form, `chooseOption` on the ui select markup, `listRow`, `followLink` both ways, field assertions,
   `expectPageStatus`, `openPageAsNewClient` sends the header.
3. Implement; export `./playwright`.

## Phase 2: Example app e2e on the helpers

**Files:** `examples/next-app/e2e/*.spec.ts`, `examples/next-app/package.json`, its lockfile.

1. Dev dependency `@softure-ai/testing` (`file:../../foundation/testing`).
2. Replace local `randomAddress`, `register`, `logIn`, the `expect.poll` + re-read pairs and the page
   status checks where the helper says the same thing; keep spec-specific steps local.
3. Run the whole e2e locally on Postgres: every spec green.
4. Gates: typecheck, lint, test, build; `npx eslint examples`.

## Progress

- [x] Phase 1: helpers and their tests
- [ ] Phase 2: example app e2e on the helpers
