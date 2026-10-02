---
change_id: db-migrator
title: "Database client and module migrator"
status: archived
roadmap_item: FD-4
branch: claude/fd-4-db-migrator-rm9sg7
created: 2026-10-02
updated: 2026-10-02
archived_at: 2026-10-02
---

## Intent

`@softure-ai/db` with a pg/PGlite client chosen by `DATABASE_URL`;
`softure migrate` applying each module's SQL in its own schema in dependency order with a
`softure.migrations` journal, checksums, an advisory lock, `--plan` and `--adopt`; and
`createTestDatabase(modules)`. Bundle-friendly for a container migrate step.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FD-4** (roadmap `foundation`):

> ### FD-4: Database client and module migrator
> - **Change ID:** `db-migrator`
> - **Status:** ready
> - **Outcome:** `@softure-ai/db` with a pg/PGlite client chosen by `DATABASE_URL`;
>   `softure migrate` applying each module's SQL in its own schema in dependency order with a
>   `softure.migrations` journal, checksums, an advisory lock, `--plan` and `--adopt`; and
>   `createTestDatabase(modules)`. Bundle-friendly for a container migrate step.
> - **Prerequisites:** FD-3.
> - **Unknowns:** whether drizzle's migrator can be reused per schema or a small custom runner is
>   simpler; the `--adopt` schema comparison method (information_schema diff vs. a checksum of
>   expected DDL).
> - **Risk:** high. Data safety for every adopting app.
> - **Baseline:** none. After: two dummy modules migrate in order on PGlite and Postgres;
>   re-running is a no-op; an edited migration fails; `--adopt` marks existing tables.
> - **PRD refs:** FR-5, FR-6, NFR-4.

Reference material: `docs/02-module-standard.md` (the standard), `docs/01-module-assessment.md` (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `foundation/db/` (the only item in this roadmap that adds migrations).
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes

Archived 2026-10-02: `@softure-ai/db` delivers the pg/PGlite client, the per-module migrator with ledger, checksums, lock, plan and adopt, `createTestDatabase` and `softure migrate` with a container bundle path, verified on PGlite and PostgreSQL 16.
