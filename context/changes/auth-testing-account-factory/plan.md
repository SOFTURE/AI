# Plan: auth-testing-account-factory

Input: change.md, research.md. Complexity: small (two phases).

## Goal

`@softure-ai/auth/testing` exports `createTestAccount`, tested on PGlite; the example app's e2e creates
the accounts of tests that are not about registration with it and stays green; auth is at 0.1.5.

**Out of scope:** factories of other modules, a session factory, publishing (the owner releases auth).

## Approach

**Chosen:** `createTestAccount(db: Queryable, input: { email, password, roles?, scrypt? }): Promise<AuthUser>`
in `src/testing/account.ts`, re-exported by `src/testing/index.ts`; user and role rows in one
transaction; email through `parseEmail`; hash through `hashPassword`. The example gets `e2e/accounts.ts`:
`createAccount(input)` (opens the e2e database, passes the config's scrypt parameters) and
`createSignedInAccount(page, input)` (the factory, then `logIn`).

**Rejected:** taking a `DatabaseHandle` (ties the factory to a pool it does not own: research); a session
token from the factory (bypasses the app's cookie options); running `onRegistered` (that is
registration, which the form already tests).

## Phase 1: The factory

**Discipline:** TDD.
**Files:** `modules/auth/src/testing/{account,index}.ts`, `modules/auth/tests/testing.test.ts`,
`modules/auth/package.json` (export `./testing`, version), `module.json` (version), README, `package-lock.json`.

1. Tests on PGlite (`tests/support.ts`): the row has the normalized email and a hash `verifyPassword`
   accepts with the given parameters; `loginUser` signs the account in; roles land in `user_roles` and
   `findUserRoles` returns them; no roles means no rows; an invalid email and a taken email throw naming
   the email and write nothing (a bad role rolls the user back too); the default parameters are auth's
   default cost.
2. Implement; add the export; bump to 0.1.5 (`npm version` for the workspace, same in `module.json`).
3. README: the entry in section 1 and a short "Testing" note.

## Phase 2: The example app's e2e

**Files:** `examples/next-app/e2e/accounts.ts`, the specs listed in research.

1. `accounts.ts` as above; specs replace their `register`/`registerAdmin` setup with it as the research
   table says, keeping the form where the test is about registration.
2. `npm run build`, `npm ci` in `examples/next-app`, migrate, build the app, run the whole e2e on the local
   Postgres: every spec green.
3. Gates: typecheck, lint, test, build; `npx eslint examples`.

## Progress

- [x] Phase 1: the factory — b9d9bdf
- [ ] Phase 2: the example app's e2e
