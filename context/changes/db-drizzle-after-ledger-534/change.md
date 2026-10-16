---
change_id: db-drizzle-after-ledger-534
title: "db: drizzleAppMigrations takes its own ledger, and a shared before/after ledger is refused (issue #534)"
status: in_progress
roadmap_item: null
issue: 534
branch: claude/project-thread-l13j1e
created: 2026-10-16
updated: 2026-10-16
---

## Intent

Close [issue #534](https://github.com/SOFTURE/AI/issues/534): the README's `after: drizzleAppMigrations("./drizzle-after")`
shares drizzle's ledger with `before`, so on a fresh database every `after` file older than the newest `before` file
is skipped silently. An app must be able to give the `after` folder its own ledger, and the shared-ledger setup must
fail loudly instead of leaving the database without objects.

## Context

db is at 0.1.11 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`.

## Constraints

- An app with only `before: drizzleAppMigrations("./drizzle")` keeps today's ledger (`drizzle.__drizzle_migrations`)
  and behaviour; its production databases must not re-apply anything.
- The refusal runs before any hook or module file, like the other checks.

## Notes

- Framing: skipped. The issue names the cause (drizzle 0.45 reads only the newest ledger row), the failure and the fix.

## Decisions (auto)

- `drizzleAppMigrations(folder, { migrationsTable?, migrationsSchema? })`, passed through to drizzle's `migrate`.
  The default stays `drizzle.__drizzle_migrations`: defaulting per folder would move every existing app's `before`
  ledger and re-run its history.
- `migrate` and `planMigrations` refuse an `AppMigrations` whose `before` and `after` are both `drizzleAppMigrations`
  hooks on the same ledger, with the new problem `db.app_migrations_shared_ledger` naming the ledger. Hand-written
  hooks are opaque and not checked.
- README example names `migrationsTable: "__drizzle_migrations_after"` for the `after` folder, with the reason.
