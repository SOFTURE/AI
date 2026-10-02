# @softure-ai/ops

**Status:** wave 1 · not implemented · depends on: core, db

`GET /health` with a registry of checks (DB + checks contributed by modules), a Docker image recipe
that runs a one-off `softure migrate` before the application starts, a pattern for admin scripts
("dry run → `--commit`", transaction, an SQL guard test), rendering `.env.prod` from secrets,
and release notes.

**Source in FIRE_TRACKER:** `src/app/api/health/route.ts`, `docker/Dockerfile`, `docker/prod/docker-compose.yml`
(the `db-migrate` service), `docker/initdb/01-app-user.sql`, `src/lib/{env-prod,release-notes}.ts`, the `scripts/*.sh` + `*.sql` pattern.
