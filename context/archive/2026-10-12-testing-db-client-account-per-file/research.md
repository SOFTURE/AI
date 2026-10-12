# Research: testing-db-client-account-per-file

Input: change.md (issue #412). Depth: quick (one package, two additive helpers, no data or auth logic changes).
Snapshot: de46d80 on claude/project-thread-iyukpb (master 97fd6dd), 2026-10-12 15:30 Europe/Warsaw.

## Summary

`@softure-ai/testing/playwright` already has `registerAccount`, `logIn` (`foundation/testing/src/playwright/auth.ts:36`,
`:61`), `uniqueEmail` and `withDatabase` (`test-data.ts:13`, `:27`). Neither helper of the issue exists. The package
has no `pg` dependency; `@softure-ai/db` shows the pattern for an optional driver: `pg` as an optional peer, loaded
with a dynamic `import("pg")` and a pool `error` listener (`foundation/db/src/client.ts:83-88`). The browser test
(`foundation/testing/tests/playwright-browser.test.ts:100-116`) runs a tiny HTTP app that records registrations, so
`signInPerFile` can be proven there without a build. `pg` is in the root `node_modules` (a devDependency of db), so a
Vitest `vi.mock("pg")` can stand in for a server; CI and this container have no Postgres outside the e2e stack.

## Current state

- `registerAccount(page, { copy, email, password, path?, landingPath? })` fills auth's form and waits for `/account`
  (`auth.ts:36-44`); `logIn` opens `/login`, submits, waits (`auth.ts:61-66`). `AuthFormCopy` is typed by shape.
- `withDatabase(open, work)` takes any `Closable` (`test-data.ts:17-35`).
- The example app's e2e opens its database through `@softure-ai/db` (`examples/next-app/e2e/database.ts:7`) and creates
  accounts with auth's factory (`examples/next-app/e2e/accounts.ts:16`); it runs `fullyParallel: true`
  (`examples/next-app/playwright.config.ts:12`).
- Playwright loads a test file once per worker; with `fullyParallel` the tests of one file can run in several
  workers, each with its own module state. A failed test restarts its worker, so module state is rebuilt.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Database client | `foundation/testing/src/playwright/database-client.ts` (new) | `createTestDatabaseClient` |
| Account per file | `foundation/testing/src/playwright/auth.ts` | `signInPerFile` next to `registerAccount` / `logIn` |
| Entry | `foundation/testing/src/playwright/index.ts` | exports |
| Manifest | `foundation/testing/package.json`, `package-lock.json` | `pg` optional peer + devDependency |
| Tests | `foundation/testing/tests/playwright-database.test.ts` (new), `playwright-browser.test.ts` | proofs |
| Docs | `foundation/testing/README.md`, `CHANGELOG.md` | API table, Unreleased |

## Data

None: the client reads and writes only what a test asks it to; no schema or migration.

## Tests

`npm test` (Vitest) runs `foundation/testing/tests/*.test.ts`; the browser suite skips without Chromium
(`tests/chromium.ts`). Gaps: no test exercises a database client in this package.

## Patterns to follow

- Optional driver: `importDriver(..., () => import("pg"))`, `pool.on("error", () => undefined)` (`db/src/client.ts:83-87`);
  a missing URL fails with a message that never contains the URL (`client.ts:71-73`).
- Helpers take one options object; JSDoc on every export; the README API table lists each export.

## Prior work

- `context/archive/*testing*` (#251, #326): built the Playwright entry and kept factories in modules' own `testing`
  exports (README "Factories"); the generic database helper there is `withDatabase`.

## SOFTURE modules

Partially covered: `@softure-ai/db` opens a drizzle handle, but a test-side raw client with labelled errors and row
counts is the gap this issue fills. `@softure-ai/auth/testing` creates accounts in SQL; `signInPerFile` is the UI path
for tests that want the real registration.

## Risks

- `pg` imported statically from the Playwright entry would break every app without `pg` → dynamic import inside
  `createTestDatabaseClient` only; public types are local so the emitted `.d.ts` never references `pg`.
- SQL injection through `countRows(table, where)` identifiers → identifiers validated and quoted, values bound.
- Two workers sharing a fixed `email` would both register → the default email is unique per call (per worker);
  documented.

## Relevant lessons

- L-001 (tsc, not bundlers): the build stays `tsc`; the dynamic import is plain ESM.

## Answers to unknowns

- Sync or async factory? `withDatabase` takes `() => Promise<THandle>` (`test-data.ts:28`) and `createDatabase` is
  async, so an async `createTestDatabaseClient(url)` fits both.
- Does the issue want a `where` beyond equality? It names `countRows(table, where)` only; equality and `IS NULL` per
  column cover counting a test's own rows.

## Open questions

- Fixed `email` versus generated: decided (auto) — `email` optional, `uniqueEmail("e2e")` by default.

## Decisions (auto)

- Depth quick; focus on the package's own API and tests.
