---
change_id: privacy-copy-drizzle-ledger-572
---

# Research: privacy-copy-drizzle-ledger-572

- `modules/privacy/src/server/copy-account.ts`: `readLedger` reads `softure.migrations` into a `module#version` →
  checksum map (empty without the table); `checkLedgers` lists differences (source-only, checksum, target-only), names
  up to five and throws `privacy.copy_ledger_mismatch`. The source ledger is read in the read-only source transaction,
  the target's inside the write transaction before anything is written, so a refusal writes nothing.
- drizzle-orm 0.45 (`pg-core/dialect.js`): the ledger is `<migrationsSchema>.<migrationsTable>` with
  `id serial, hash text NOT NULL, created_at bigint`; `created_at` is the journal entry's `folderMillis` (`when`), so
  the same migration has the same `created_at` and `hash` in both databases.
- `@softure-ai/db` `drizzleAppMigrations(folder, { migrationsTable?, migrationsSchema? })` defaults to
  `drizzle.__drizzle_migrations`; a second folder needs its own table (issue #534). The migrator reserves the `drizzle`
  schema for drizzle's ledger.
- Tests: `modules/privacy/tests/copy-account.test.ts` builds two PGlite databases (`createTestPrivacy`); the ledger
  test edits `softure.migrations` in the target and checks the exact detail and that nothing was written.
- Docs: `modules/privacy/README.md` "Same migrations" and the refusal list describe the ledger as `softure.migrations`.
