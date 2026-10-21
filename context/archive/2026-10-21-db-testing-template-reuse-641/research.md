---
change_id: db-testing-template-reuse-641
status: done
---

# Research: db/testing template and reuse (issue #641)

## Current code

- `foundation/db/src/testing.ts`: `templates: Map<string, Promise<Blob>>` keyed by module ids, migration dir URLs,
  hook ids (a `WeakMap` per hook object) and the baseline. `buildTemplate` migrates a fresh PGlite and keeps
  `dumpDataDir("none")`; every call does `new PGlite({ loadDataDir })`. Module-level state, so one template build per
  test file under Vitest isolation.
- `foundation/db/src/migrations/drizzle.ts`: `drizzleAppMigrations(folder, options)` returns a closure; a `WeakMap`
  records its ledger. The folder path is not recorded, so a drizzle hook cannot be identified across processes today.
- Repository callers: 40+ test files across `modules/*` call `createTestDatabase`; `vitest.config.mts` has no
  `globalSetup`.

## Measurements (PGlite 0.5.10, this container)

- Fresh PGlite + small schema + `dumpDataDir("none")`: ~2.9 s, 40 MB tarball. `loadDataDir` from it: ~0.4 s.
- `TRUNCATE` of two tables: ~1.6 ms. `COPY t TO '/dev/blob'` and `COPY t (cols) FROM '/dev/blob'` round-trip jsonb,
  arrays and identity columns exactly; `session_replication_role = replica` lets the restore ignore FK order.

## Vitest

- `globalSetup` runs in the main process before workers start; workers inherit `process.env`, so an environment
  variable set there reaches `createTestDatabase` without importing Vitest in the db package.

## lefthook 2.1

- `skip: [{ run: <command> }]` skips a job when the command exits 0. Git's pre-push stdin is not available to it, so
  the pushed range is taken as `@{push}..HEAD` (the current branch); no upstream means no skip.

## Risks

- Reuse cannot undo DDL a test runs: detect it with a catalog fingerprint and replace the instance.
- Session state (`SET`, temp tables, `LISTEN`, advisory locks) survives reuse: `DISCARD ALL` before the restore.
- Typed ESLint rules make `--cache` unsound (see change.md).
