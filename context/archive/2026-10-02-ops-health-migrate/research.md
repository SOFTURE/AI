# Research: ops-health-migrate

Input: change.md. Sources: FIRE_TRACKER (read-only clone), `foundation/core`, `foundation/db`
(README §4: the bundled migrate runner), `spikes/next-actions/`, `examples/next-app`, docs/02 §4, §8, §9.

## Current state

- `modules/ops/` is a stub: README ("not implemented"), empty `src/`, `migrations/`, `tests/`.
  It is not a workspace yet.
- Route handlers ship from a package and mount with one re-export line (docs/02 §8, ID-1). Package
  code reads the app config with `getSoftureConfig()` (`@softure-ai/core/next`).
- `@softure-ai/db` already has everything the migrate step needs: `runMigrateCli`, a three-line app
  script that esbuild bundles, `--export-migrations <dir>` at build time and `--migrations-dir <dir>`
  at run time (db README §4). No container recipe uses it yet, and the example app has no image.
- The module contract (`defineModule`) has no way for a module to contribute a health check.
  `ModuleContext { db, clock, config }` is what server functions receive (db typed `unknown` in core).
- There is no shared database handle for package code: the example app's own route
  (`app/api/security/ping`) opens one through its `lib/database.ts`.

## FIRE_TRACKER sources

- `src/app/api/health/route.ts`: `select 1` through the app's pool; 200 `{ status: "ok" }`, 503
  `{ status: "unavailable" }`; the cause goes to the server log only; `dynamic = "force-dynamic"` so
  `next build` cannot freeze a green answer. Measured there: `/login` answered 200 with Postgres
  stopped, `/api/health` 503.
- `docker/Dockerfile`: deps → builder → runner; `npm ci` with `CI=true` (no git hooks); `next build`
  with `output: "standalone"`; `scripts/migrate.ts` bundled by esbuild (`pg` external); a non-root
  user; `HEALTHCHECK` via `node -e` (alpine has no curl) against `/api/health`; one image, two roles
  (app and migrate).
- `docker/prod/docker-compose.yml`: a one-shot `db-migrate` service from the same image; the app
  depends on it with `service_completed_successfully`.
- `docker/initdb/01-app-user.sql`: a second role, because `POSTGRES_USER` is a superuser; passwords
  through `\set` from the environment (`:"POSTGRES_DB"` does not work in initdb). The role gets
  `CONNECT, CREATE` on the database because migrations need to create a schema: the app role there
  can still run DDL.
- Ops scripts (`scripts/dostep.sh` + `dostep.sql`, `haslo.*`): dry run by default, `--commit`
  appends `commit;` instead of `rollback;`, the SQL prints a `before` and an `after` row and the
  shell refuses to print a result without both; strict argument validation; values go through
  `\set`, never through the ssh command line. Guard tests (`src/db/haslo-sql.test.ts`) run the SQL
  file on PGlite with commit and rollback and check effects and refusals (no match, two matches).
- `scripts/migrate-account.mts`: the TypeScript form of the same pattern (dry run, `--commit`, the
  invariant counted inside the open transaction, rollback and exit 1 on a mismatch).

## Answers to the roadmap unknowns

1. **`.env.prod` rendering and release notes stay app-specific.** FIRE's `render-env-prod.mts` and
   `release-notes.mts` encode that app's secret names, hosting and changelog format; nothing in
   them is shared by another app today. The README records them as out of scope.
2. **Module checks are registered at runtime through the module contract.** A module passes
   `health` to `defineModule` (like `privacy`); the enabled module carries it, and the ops route runs
   the check of every module listed in the config. A manifest flag would only say a check exists;
   the function has to travel with the module anyway. The app adds its own checks through the ops
   options.

## Decisions for the plan

- Least privilege in the container: two roles. A migrator role owns the module schemas (`CONNECT,
  CREATE` on the database) and runs `softure migrate`; the app role gets only `USAGE` on the schemas
  and row privileges on tables and sequences through `ALTER DEFAULT PRIVILEGES FOR ROLE <migrator>`,
  so a leaked app URL cannot run DDL. This goes beyond FIRE's single app role.
- The health route needs a database handle inside the package: ops keeps one small pool per URL on
  `globalThis` (as the example app does), separate from the app's pool.
- A public endpoint with no input and a fixed cost: concurrent requests share one run of the checks
  (single flight) instead of a database-backed rate limit, which would make health depend on the
  database it reports on.
- Verification: unit tests on PGlite; an e2e spec against `next start`; a container run (image
  build, one-off migrate, app healthy, Postgres stopped gives 503) as a CI job.
