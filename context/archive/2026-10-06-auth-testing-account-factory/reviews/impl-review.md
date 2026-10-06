# Implementation review: auth-testing-account-factory

Scope: full · Date: 2026-10-06 · Gates: typecheck, lint, test, build, `npx eslint examples`, the example app's
typecheck, example app e2e (119 passed on the local Postgres)

## Verdict

Ready. `@softure-ai/auth/testing` exports `createTestAccount`, tested on PGlite; 15 of the example's specs create
their accounts with it, the form stays where a test is about registration, and the whole e2e is green.

| Dimension | Verdict | Notes |
| --- | --- | --- |
| Plan coverage | PASS | both phases; the research table's split is what the specs do |
| Tests | PASS | `tests/testing.test.ts` (7): normalized email, a hash `verifyPassword` and `loginUser` accept with no rehash, auth's default cost, roles read back by `findUserRoles`, no role rows without roles, invalid and taken email throw naming the email and write nothing, a refused role rolls the account back |
| API | PASS | `Queryable` like `@softure-ai/auth/server`; an options object; returns `AuthUser`; throws only for bugs of the test (repository rule) |
| Layering | PASS | nothing under `src/` outside `src/testing/` imports it (grep); `exports` lists `./testing` source, types, built file (`packages.test.ts`) |
| Example e2e | PASS | 119/119; edits are mechanical: `createSignedInAccount` (factory + `logIn`, landing on `/account` like registration) or `createAccount` where a test only needs the account to exist; admins get `roles: ["admin"]` instead of an SQL insert or the `grant-role` script, which `auth-roles.spec.ts` still runs |
| Kept on the form | PASS | `auth.spec.ts` registration tests (cookie, no-JavaScript round trip, the taken-email submission), `privacy-consents`, `analytics-*`, the registration attempts in `registration-switch` |
| Version | PASS | 0.1.6 in `package.json`, `module.json`, the module's manifest and both lockfiles; `auth@0.1.5` was tagged on `master` during this change, so 0.1.5 was no longer free |
| Language | PASS | language gate on every commit |

## Findings

- Fixed during review: two specs passed `email: email` (object shorthand) after the mechanical replacement.
- Observed, not a defect: the factory hashes in the Playwright worker with the app's cost (2^17), so each
  account costs one hash there and one at login, as before (registration hashed once on the server).
- No new gaps.
