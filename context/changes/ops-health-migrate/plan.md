# Plan: ops-health-migrate

Input: change.md, research.md. Complexity: medium (3 phases).

## Goal

`@softure-ai/ops` (`modules/ops/`) is a workspace package that gives an app:

- `ops({ checks?, timeoutMs?, detail? })`, the module factory (no tables, route `health: /api/health`);
- `@softure-ai/ops/next`: `GET`, mounted as `app/api/health/route.ts → export { GET } from "@softure-ai/ops/next"`;
  200 `{ status: "ok" }` when the database and every check pass, 503 `{ status: "unavailable" }`
  otherwise; `detail: "checks"` adds `checks: { <name>: "ok" | "failed" | "timed_out" }`;
- `@softure-ai/ops/server`: `runHealthChecks(context, options)` and `collectHealthChecks(config)`;
- `@softure-ai/ops/scripts`: `defineOpsScript`, `runOpsScript` (argv → exit code) and
  `executeOpsScript` (one transaction, rolled back unless `commit`), the helper for safe ops scripts;
- `recipes/`: `initdb/01-roles.sql` (migrator and app roles) shipped in the package, and the
  container recipe in the README;
- a core addition: `defineModule({ health })`, so any module contributes a check.

Baseline: FIRE's health route behaviour (200 with a live database, 503 with Postgres stopped,
nothing revealed) from the module, verified by unit tests, the example app e2e and a container run.

**Out of scope:** `.env.prod` rendering and release notes (app-specific, research answer 1),
readiness vs liveness split, metrics.

## Approach

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Check registration | `health?: HealthCheck` in `defineModule`, carried as `module.health`; app checks in `ops({ checks })` | runtime, travels with the module | research answer 2 |
| Check shape | `(context: ModuleContext) => Promise<Result<undefined>>`; a throw or an `Err` is `failed`, past `timeoutMs` (default 3000) `timed_out` | expected failures are values; a throw is still a red check | AGENTS.md |
| Database check | `select 1` when `config.database` is set, named `database`, always first | FIRE baseline | research |
| Database handle | one pool per URL (`max: 2`) on `globalThis` under a `Symbol.for` key | package code has no app handle; reloads must not leak pools | research |
| Response | `{ status }`, `cache-control: no-store`; detail only with `detail: "checks"`; causes logged with `errorLogLabel` and the check name | public route, no reconnaissance | FIRE, core safe-error |
| Abuse | concurrent requests share one in-flight run (single flight) | no input, fixed cost; a DB-backed limiter would couple health to the DB | research |
| Static build | verify `next build` lists the route as dynamic; the handler reads nothing cached | FIRE `force-dynamic` lesson | research |
| Ops scripts | `defineOpsScript({ name, description, args: zod schema, run(tx, args) → { before, after } })`; `--key=value` args, `--commit` reserved, `--help`; dry run rolls back through a sentinel error; exit 0 / 1 / 2 as `softure migrate` | FIRE pattern, one transaction | research |
| Roles | `softure_migrator` (CONNECT, CREATE on the database) and `softure_app` (USAGE on schemas, row privileges through `ALTER DEFAULT PRIVILEGES FOR ROLE softure_migrator`); names and passwords from the environment through `\set` | least privilege; FIRE's initdb lesson | research |
| Container | example app `Dockerfile` (repo root context): build packages, `npm ci` the app, `next build` standalone, bundle `scripts/migrate.ts`, export migrations; runner non-root with `HEALTHCHECK`; compose with `postgres`, one-shot `migrate`, `app` | FIRE Dockerfile, db README §4 | research |

## Phase 1: Core contract and health

- `foundation/core`: `HealthCheck` type, `ModuleSpec.health`, `SoftureModule.health` (`null` when absent), tests.
- Copy `templates/package/` to `modules/ops/` (keep `index`, `contract`, `messages`, `server`, `next`; drop `ui`), name it
  `@softure-ai/ops`, dependencies `@softure-ai/core`, `@softure-ai/db`, `zod`, peer `drizzle-orm`; lockfile.
- `src/options.ts`, `src/index.ts` (`ops` via `defineModule`, `module.json`), `src/server/health.ts`,
  `src/next/route.ts`, `src/next/database.ts`, messages (`en`, `pl`) for the check states.
- Tests: all pass → 200; a failing, throwing and slow module check → 503 with the right state; no
  database configured → no database check; detail off hides names; single flight shares one run;
  the database check on PGlite and on a closed handle; `module.json` equals `toModuleJson(ops)`.

## Phase 2: Safe ops scripts

- `src/scripts/`: `defineOpsScript`, `parseOpsArgs`, `executeOpsScript`, `runOpsScript`.
- Tests on PGlite: dry run leaves no change and prints both rows; `--commit` writes; a throw in
  `run` rolls back and exits 1; a report without `before`/`after` refuses; unknown and invalid
  arguments exit 2 with usage; `--help`.
- README with the twelve sections, the container recipe and the ops script pattern; `recipes/initdb/01-roles.sql`.

## Phase 3: Example app, e2e and container run

- Example app: dependency `@softure-ai/ops`, `ops({ detail: "checks" })` in `softure.config.ts`,
  a guestbook health check (its table answers), `app/api/health/route.ts` (one line),
  `REGISTERED_MODULE_IDS` in `e2e/next-actions.spec.ts`.
- `e2e/ops.spec.ts`: 200, `{ status: "ok", checks: { database: "ok", guestbook: "ok" } }`, `no-store`.
- Container: `examples/next-app/Dockerfile`, `.dockerignore` at the root, `scripts/migrate.ts`,
  `compose.container.yaml` (roles SQL mounted from `modules/ops/recipes/initdb`), `scripts/container.mjs`
  (build, migrate as the migrator, app healthy as the app role, 200, stop Postgres, 503, tear down),
  root script `e2e:container`, a `container` job in `.github/workflows/e2e.yml`.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Core contract and health

#### Automated
- [x] 1.1 Core health contract tests pass — 28173a3
- [x] 1.2 Health aggregation, route and database check tests pass on PGlite — 28173a3
- [x] 1.3 `module.json` equals `toModuleJson(ops)` and the package passes `tests/repo/packages.test.ts` — 28173a3
- [x] 1.4 Gates green (typecheck, lint, test, build) — 28173a3

### Phase 2: Safe ops scripts

#### Automated
- [x] 2.1 Ops script helper tests pass on PGlite — 28173a3
- [x] 2.2 pl and en dictionaries have the same keys and README links pass the link test — 28173a3
- [x] 2.3 Gates green (typecheck, lint, test) — 28173a3

### Phase 3: Example app, e2e and container run

#### Automated
- [x] 3.1 `npm run e2e` passes against a local PostgreSQL 16, including `ops.spec.ts` — c9f8b64
- [x] 3.2 `npm run e2e:container` passes: migrate as the migrator, health 200 as the app role, 503 with Postgres stopped — c9f8b64
- [x] 3.3 Gates green (typecheck, lint, test) — c9f8b64
