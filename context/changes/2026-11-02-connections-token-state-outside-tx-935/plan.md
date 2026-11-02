---
change_id: connections-token-state-outside-tx-935
status: in_progress
---

# Plan: token state outside the caller's transaction (issue #935)

Input: change.md, research.md. Complexity: small (one helper, three entry points, tests, docs).

## Phase 1: tests first, then the state database (TDD)

Files: `modules/connections/src/server/state-database.ts` (new), `src/server/tokens.ts`, `src/server/credentials.ts`,
`tests/postgres.ts` (new), `tests/rollback-935.test.ts` (new).

1. Tests first, on a real Postgres (skipped locally without `SOFTURE_TEST_POSTGRES_URL`, required in CI):
   - a refresh inside a transaction that then rolls back leaves the rotated refresh token stored, and the next refresh
     spends the new token (the fake provider would answer `invalid_grant` for the spent one);
   - `invalid_grant` inside a rolled-back transaction leaves the account `reconnect_required` and the hook ran once;
   - a standing 401 through `requestWithConnection` inside a rolled-back transaction leaves `reconnect_required`;
   - a caller that is not in a transaction behaves as before (the existing PGlite tests stay green unchanged).
2. `getStateContext(ctx)`: `ctx` itself unless `ctx.db` is a `PgTransaction` and the config's database resolves to a
   `postgres` handle without opening anything else (an app `database.handle`, or a `postgres://` URL); then
   `{ ...ctx, db: handle.db }`.
3. `readAccessToken` and `reportCredentialRejected` run on the state context: lease, reads, stored tokens, failure,
   `reconnect_required` and the hook.

## Phase 2: docs

`modules/connections/README.md` (where the token state is written, PGlite exception, pool size, the hook's
`ctx.db`), `modules/connections/CHANGELOG.md` under `## Unreleased`.

## Decisions (auto)

- The issue's first proposal (writes outside the transaction), not a helper or a `processSyncItem` option: it fixes
  every caller without an app change.
- The outside database comes from `config.database` (`getConfiguredDatabase`), the same handle the Next adapter uses;
  no new option.
- PGlite (one connection) keeps the old behaviour: there is no second connection to write on.
- The hook gets the state context, so its own writes (an alert job) commit even when the caller rolls back.
- No version bump: the coordinator releases.

## Progress

- [ ] Phase 1
- [ ] Phase 2
