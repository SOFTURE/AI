---
change_id: ops-health-migrate
title: "Apps get a health endpoint with module checks, a container migrate step and a safe ops script helper from @softure-ai/ops"
status: archived
roadmap_item: ID-7
branch: claude/id-7-ops-health-migrate-8yxme9
created: 2026-10-02
updated: 2026-10-02
archived_at: 2026-10-02
---

## Intent

An app built on SOFTURE modules gets its operational basics from `@softure-ai/ops` instead of
writing them again:

- `GET /api/health`, mounted with one line, answers 200 only when the database and every check
  contributed by an enabled module pass, and 503 otherwise, without revealing anything to a stranger;
- a container recipe, verified on the example app, that runs `softure migrate` as a one-off step
  before the app starts, with a migrator role that owns the schemas and an app role that can only
  read and write rows;
- the safe ops script pattern (dry run by default, `--commit` applies, one transaction, a guard
  test) as a helper with docs.

## Context

Roadmap identity, item **ID-7** (the entry is [`backlog-input.md`](backlog-input.md)). Builds on
ID-1 (`next-actions-spike`): route handlers ship from the package and the app re-exports them;
package code reads the config through `getSoftureConfig()`.

FIRE_TRACKER sources (read-only): `src/app/api/health/route.ts`, `docker/Dockerfile`,
`docker/prod/docker-compose.yml`, `docker/initdb/01-app-user.sql`, `scripts/*.sh` + `*.sql`
with their `src/db/*-sql.test.ts` guards, `scripts/migrate-account.mts`.

## Constraints

- Exclusively owns `modules/ops/` and `examples/next-app/e2e/ops.spec.ts`; adds new files to the
  example app (`Dockerfile`, container compose, `app/api/health/route.ts`, its migrate script).
- Shared hot files: `examples/next-app/softure.config.ts`, `e2e/migrations.spec.ts`,
  `e2e/next-actions.spec.ts` (append only this module's entries). ID-3 (`auth-core`) runs in
  parallel and touches the same files: merge master before the PR.
- A small additive change to `foundation/core` (a module may contribute a health check); no
  other foundation API changes.
- FIRE_TRACKER is read-only. English-only code. No release, tag or publish.

## Notes

- Verified 2026-10-02: unit tests (PGlite); `npm run e2e` against PostgreSQL 16 with the app
  connected as `softure_app` (migrated as `softure_migrator`), 15/15; `npm run e2e:container`
  (image built, one-off migrate, 200, DDL refused for the app role, 503 with Postgres stopped);
  `recipes/existing-database.sql` on a database migrated as the superuser (migrator can alter, app
  role rows only).
- Mode: fully autonomous (owner decision 2026-10-02): self-review, merge to master, branch
  cleanup by GitHub auto-delete.
- Archived 2026-10-02: `@softure-ai/ops` delivers `GET /api/health` with database and module checks (`defineModule({ health })` in core), the container recipe with a one-off migrate step under migrator and app roles, and the safe ops script helper, verified on PGlite, PostgreSQL 16, the example app e2e and its container run.
