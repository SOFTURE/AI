# Research: auth-only-account-seed-411

## Current state

- `modules/mcp-access/src/stdio/serve.ts` has a private `resolveAccount(database, requested, userIdEnv)`: a non-empty
  value must be a uuid that names a row in `auth.users` (else `mcp-access.stdio_account_unknown`); empty reads at most
  two users and refuses none (`stdio_no_account`) or two (`stdio_account_ambiguous`). Never the first of several.
  Tests: `modules/mcp-access/tests/adoption-gaps-315.test.ts` assert the three codes and exact messages.
- `@softure-ai/auth/server` exports module functions taking `AuthContext` (`{ db, clock, config }`); the resolver only
  needs a `Queryable`, so it takes `{ db }` like the issue proposes.
- `@softure-ai/auth/scripts` holds ops scripts (`@softure-ai/ops/scripts`, dry run by default). A development seed is
  not an operator change on a live database, so the ops pattern (dry run, `--commit`, before/after) does not fit; a
  plain entry returning an exit code does, using `CliOutput` and the exit codes from `@softure-ai/db/cli` (auth
  already depends on `@softure-ai/db`).
- `registerUser(ctx, { email, password, hasConsented, clientKey })` validates, counts the `register` bucket, hashes,
  inserts, runs `onRegistered` and opens a session in one transaction; `auth.email_taken` on a duplicate.
  `logoutSession(ctx, token)` ends one session.
- `openCommandDatabase(config.database, { max: 1 })` opens the app database (used by mcp-access stdio and ops).
- mcp-access depends on `@softure-ai/auth` `^0.1.0`; release-rules require internal ranges the workspace version
  satisfies, so the range can only be raised when auth's new version exists (release step).

## Approach

Move the resolver into `modules/auth/src/server/only-account.ts`, export it, call it from mcp-access with
`env: { [userIdEnv]: requested }` semantics kept. Add `modules/auth/src/scripts/seed-account.ts`.
