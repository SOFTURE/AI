---
change_id: privacy-copy-drizzle-ledger-572
title: "privacy: copyAccount's ledger check also compares the app's drizzle journal (issue #572)"
status: in_progress
roadmap_item: null
issue: 572
branch: claude/project-thread-bz2ak2
created: 2026-10-18
updated: 2026-10-18
---

## Intent

Close [issue #572](https://github.com/SOFTURE/AI/issues/572): `copyAccount` (and `createCopyAccountScript`) compares
only the `softure.migrations` ledgers, so a column added only by the target's own drizzle migrations silently takes
NULL in every copied row. The ledger check must also see the app's drizzle journal, so the adopting app can drop the
wrapper that compares the journals itself.

## Context

Labels: `privacy`, `enhancement`. privacy 0.2.0 is the latest on master. Releases are batched by the coordinator: no
version bump here, the CHANGELOG gets `## Unreleased`.

## Constraints

- A database without the `drizzle` schema behaves as today.
- Same model as the module ledger: a refusal writes nothing and names the difference in `copy_ledger_mismatch`.

## Notes

- Framing: skipped. The issue states the problem, the proposal and the acceptance.

## Decisions (auto)

- Automatic, no new option: the issue's second variant. Every table in the `drizzle` schema with drizzle's ledger shape
  (`hash`, `created_at`) is compared, which covers `__drizzle_migrations` and the extra ledgers `drizzleAppMigrations`
  allows (`migrationsTable`), with no configuration to forget. `ledger: "ignore"` still skips everything.
- A drizzle row is keyed `drizzle.<table>#<created_at>` (the journal's `when`, equal on both sides for the same
  migration) with `hash` as its checksum, so the detail reads like the module rows
  (`drizzle.__drizzle_migrations#1760000000000 only in the target`, `... has another checksum`).
- A ledger in a custom `migrationsSchema` is not seen; the README says so (`@softure-ai/db` reserves `drizzle` for it).
