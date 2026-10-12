---
change_id: auth-only-account-seed-411
status: archived
---

# Plan: auth single-account resolver and seed (issue #411)

Input: change.md, research.md. Complexity: small (one moved function, one new entry, docs).

## Phase 1: resolveOnlyAccount (TDD)

Files: new `modules/auth/src/server/only-account.ts`, `modules/auth/src/server/index.ts`,
`modules/mcp-access/src/stdio/serve.ts`; test `modules/auth/tests/only-account-seed.test.ts`.

1. Tests first (red on master): named id found; named id unknown, not a uuid, or blank-trimmed; no account; one
   account; two accounts and no name; `env` defaults to `process.env`; messages name `envName`.
2. Implement `resolveOnlyAccount({ db, envName, env })` → `Ok<string> | OnlyAccountError`. mcp-access calls it and
   maps the three codes to its own codes and messages; the existing stdio tests stay green unchanged.

## Phase 2: runSeedAccount (TDD)

Files: new `modules/auth/src/scripts/seed-account.ts`, `modules/auth/src/scripts/index.ts`; same test file.

1. Tests: creates the account through registration (hook called, password logs in, no session left); a second run
   reports "already there" and changes nothing; missing `SEED_EMAIL`/`SEED_PASSWORD` is a usage error (exit 2);
   a short password or invalid email is refused with the reason (exit 1); `NODE_ENV=production` refused; output never
   prints the password.
2. Implement with `database` / `output` / `clock` options for tests.

## Phase 3: docs

`modules/auth/README.md` (resolver and seed), `modules/mcp-access/README.md` (one line: stdio uses the auth resolver),
`modules/auth/CHANGELOG.md` and `modules/mcp-access/CHANGELOG.md` `## Unreleased`.

## Progress

- [x] Phase 1: resolveOnlyAccount (`2b46cb4`; the new tests failed on master, the mcp-access stdio tests pass unchanged)
- [x] Phase 2: runSeedAccount (`9dad50e`; auth's 369 tests green)
- [x] Phase 3: docs (`ea0ff8a`)

Gates on the branch: `npm run typecheck`, `npm run lint`, `npm run build` green; auth (369) and mcp-access (259) tests
pass, the full `npm test` runs in pre-push.
