# Plan: testing-db-client-account-per-file

Input: change.md, research.md. Complexity: small (one package, two additive helpers following existing patterns).

## Goal

An app imports `createTestDatabaseClient` and `signInPerFile` from `@softure-ai/testing/playwright` instead of
keeping its own copies: a test opens a raw client on the integration database, counts its own rows and gets errors
that name the failed statement; a test file signs in with one account it registered itself, so files run in parallel.

**Out of scope:** factories for module rows (they stay in modules' `testing` exports), PGlite URLs, a version bump.

## Approach

**Starting point:** `registerAccount` / `logIn` exist (`auth.ts:36`, `:61`), `withDatabase` takes any `Closable`
(`test-data.ts:27`); the package has no `pg` dependency.

**Chosen:** two small modules in the Playwright entry, `pg` loaded lazily as an optional peer, both helpers built on
what is there. Rejected: putting the client in `@softure-ai/db/testing` (the issue and the app want it next to
`withDatabase`, and db's handle is drizzle, not a raw client); a static `pg` import (breaks apps without `pg`).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Factory shape | `async createTestDatabaseClient(url, { max? })` | fits `withDatabase(open)` and mirrors `createDatabase` | research |
| `pg` | optional peer + devDependency, dynamic import, local types | apps without `pg` keep working | research |
| `countRows` where | `{ column: value }`, equality, `null` → `IS NULL` | covers counting own rows; values bound | plan |
| Identifiers | `name` or `schema.name`, `[A-Za-z_][A-Za-z0-9_]*`, quoted; else `RangeError` | no injection | plan |
| Query error | `Error("Test database query failed: <statement>", { cause })` | the issue's "labels its error with the statement" | change |
| Account email | optional, `uniqueEmail("e2e")` by default; password optional, random | one account per file per worker | research |

**Critical details:** with `fullyParallel` each worker loads the file anew, so the generated email gives each worker
its own account; a caller passing a fixed `email` must not run that file's tests in several workers. Concurrent
`signIn` calls in one worker wait for the single registration before logging in.

## Phase 1: Test database client

**Discipline:** TDD. **Files:** `foundation/testing/src/playwright/database-client.ts`,
`foundation/testing/src/playwright/index.ts`, `foundation/testing/tests/playwright-database.test.ts`,
`foundation/testing/package.json`, `package-lock.json`

1. `database-client.ts`: `createTestDatabaseClient(url, options?)` refuses an empty URL (message without the URL),
   imports `pg` dynamically (a missing package fails with "install pg"), opens a `Pool` with an `error` listener.
   Contract: `TestDatabaseClient { query<TRow>(statement, params?): Promise<TRow[]>; countRows(table, where?):
   Promise<number>; close(): Promise<void> }`; `close` is idempotent.
2. `index.ts`: export `createTestDatabaseClient`, `TestDatabaseClient`, `TestDatabaseClientOptions`.
3. `package.json`: `pg` `^8.11.0` optional peer, `pg` in devDependencies; lockfile through `npm install`.

**Tests:** with `vi.mock("pg")`: rows returned; params passed; a failing query rejects naming the statement with the
driver error as `cause`; `countRows` builds `SELECT count(*)::int` with quoted identifiers, `$n` values and
`IS NULL`, no `WHERE` for an empty filter; an invalid identifier is refused before any query; empty URL refused;
`close` ends the pool once; works inside `withDatabase`.

**Done when:**
- Automated: `playwright-database.test.ts` passes; the built `dist/playwright/*.d.ts` does not reference `pg`;
  Gates green (typecheck, lint, test).

## Phase 2: One account per test file

**Discipline:** TDD. **Files:** `foundation/testing/src/playwright/auth.ts`, `foundation/testing/src/playwright/index.ts`,
`foundation/testing/tests/playwright-browser.test.ts`, `foundation/testing/README.md`, `foundation/testing/CHANGELOG.md`

1. `auth.ts`: `signInPerFile({ copy, email?, password?, registerPath?, loginPath?, landingPath? })` returns
   `PerFileAccount { email, password, signIn(page) }`; the first `signIn` registers (`registerAccount`), later ones
   (also concurrent ones, after the registration settles) log in (`logIn`); a failed registration is retried by the
   next `signIn`.
2. `index.ts`: export `signInPerFile`, `PerFileAccount`, `SignInPerFileOptions`.
3. README: API table rows and a short example; CHANGELOG `## Unreleased` with both helpers (#412).

**Tests:** in the browser suite: two `signIn` calls register once and log in once, both land on `/account`; the
default email is unique and on `example.com`; a refused registration rejects and the next `signIn` registers again.

**Done when:**
- Automated: the new browser tests pass; README lists both exports; CHANGELOG has `## Unreleased`; Gates green
  (typecheck, lint, test).

## Risks and rollback

- An app without `pg` imports the entry → covered by the lazy import; revert phase 1 to roll back.
- Behaviour of existing helpers unchanged; phase 2 reverts on its own.

## Decisions (auto)

- Complexity small, two phases, no questions asked.
- `max` pool option defaults to 2 (tests need few connections); other `pg` options not exposed.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Test database client

#### Automated
- [x] 1.1 `playwright-database.test.ts` passes
- [x] 1.2 The built `dist/playwright/*.d.ts` does not reference `pg`
- [x] 1.3 Gates green (typecheck, lint, test)

### Phase 2: One account per test file

#### Automated
- [ ] 2.1 The new `signInPerFile` browser tests pass
- [ ] 2.2 README lists both exports and CHANGELOG has `## Unreleased`
- [ ] 2.3 Gates green (typecheck, lint, test)
