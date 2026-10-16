---
change_id: db-drizzle-after-ledger-534
---

# Research: db-drizzle-after-ledger-534

Sources: `foundation/db/src/migrations/drizzle.ts`, `foundation/db/src/migrations/migrator.ts`,
`foundation/db/src/migrations/problems.ts`, `foundation/db/README.md` ("The app's own migrations"),
`node_modules/drizzle-orm/pg-core/dialect.js` (0.45.3), `node_modules/drizzle-orm/migrator.d.ts`,
`foundation/db/tests/app-migrations.test.ts`, `foundation/db/tests/process-glue-404.test.ts`.

- `drizzleAppMigrations(folder)` calls drizzle's `migrate(handle.db, { migrationsFolder })` for the handle's driver,
  with no `migrationsTable` / `migrationsSchema`, so every such hook uses `drizzle.__drizzle_migrations`.
- drizzle 0.45.3 `PgDialect.migrate` (shared by node-postgres and pglite): reads `order by created_at desc limit 1`
  and applies a file only when `lastDbMigration.created_at < migration.folderMillis`. Confirmed: with a shared ledger
  an `after` file older than the newest `before` file is never applied, with no error.
- `MigrationConfig` already accepts `migrationsTable` and `migrationsSchema` (defaults `__drizzle_migrations`,
  `drizzle`); the dialect creates the schema and table if missing.
- `migrate` checks the baseline before taking the lock and returns problems as values (`failWith`); a new check for
  the hooks fits next to `checkBaseline`, in both `migrate` and `planMigrations`.
- `createTestDatabase` builds its template through `migrate`, so the refusal reaches tests too.
- Hooks are plain functions; the migrator can only tell a drizzle hook and its ledger through metadata the factory
  records (a `WeakMap` keyed by the hook, as `testing.ts` already does for template ids).
- The `drizzle` schema is reserved for modules (`RESERVED_SCHEMAS`), so a second ledger in it cannot collide with a
  module schema.
