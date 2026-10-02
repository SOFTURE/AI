# @softure-ai/db

**Status:** wave 0 · not implemented

- Postgres client (`pg.Pool`) or PGlite (`pglite://…`), with `Database` and `Queryable` types.
- **Module migrator:** one Postgres schema per module, a `softure.migrations` table, checksums,
  advisory lock, `--plan`, `--adopt`. The `softure migrate` CLI can be bundled into a Docker image.
- `createTestDatabase(modules)`: PGlite with the migrations of the given modules (for vitest).

Its own migration in `migrations/` creates the `softure` schema and the ledger table.

**Source in FIRE_TRACKER:** `src/db/client.ts`, `src/db/test-db.ts`, `scripts/migrate.ts`,
`docker/Dockerfile` (esbuild `migrate.cjs`).
