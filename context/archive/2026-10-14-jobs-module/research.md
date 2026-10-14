---
change_id: jobs-module
---

# Research: Postgres-backed background jobs (issue #471)

## Current state (master f5830d0)

- No package runs background work. Workarounds in this repository: billing's `sendAccessReminders` and
  `expireStaleRequests` are meant for an app cron; mailing keeps its own delivery ledger with retries; the blog pings
  IndexNow inside the request. Each is a follow-up issue once this package exists.
- Module shape to copy: `modules/security` (one schema, one migration, `server/` functions on
  `ModuleContext<Queryable>`, `getModule(config, MODULE_ID)` for options, tests on `createTestDatabase`).
- `@softure-ai/core`: `defineModule` (manifest, options schema, `migrations.dir`, `health`), `Result`/`ok`/`err`,
  `Clock`/`systemClock`/`createTestClock`, `errorLogLabel`, `safeError`.
- `@softure-ai/db`: `Queryable` (connection or open transaction), `Database`, `openCommandDatabase(config.database,
  { max })` for a command's own process (the worker is one), `createTestDatabase(modules)` (PGlite with the real
  migrations).
- `@softure-ai/observability`: `Logger` (`debug/info/warn/error(message, fields)`, `child`). Only the example app
  depends on it; modules log with `console.error` (security's pruning).
- `@softure-ai/ops`: `GET /api/health` runs every enabled module's `health(context)`; `runOpsScript` shows how a
  package writes a process entry that sets `process.exitCode` and closes its pool.
- `@softure-ai/deploy init` (`tools/deploy/src/init/`): `readAppFacts` turns dependencies into facts
  (`@softure-ai/db` → database, `@softure-ai/ops` → health route); `TEMPLATE_FILES` decides which templates render;
  the `Dockerfile` bundles `scripts/migrate.ts` and `scripts/ops/*.ts` with esbuild; the compose file has `app`,
  `migrate`, `postgres`. The image carries a `HEALTHCHECK` on port 3000, which a worker container must disable.
  `initdb/01-roles.sql` grants the app role DML on every schema the migrator creates, so `jobs.jobs` needs nothing new.
- Release: a brand-new package's first npm publish needs the `NPM_TOKEN` secret (scripts/release/README.md §First
  release of a new package).

## Approach

- Table `jobs.jobs`: `id bigint identity`, `queue`, `payload jsonb`, `status` (`pending`, `running`, `succeeded`,
  `failed`, `cancelled`), `attempts`, `max_attempts`, `run_at`, `locked_until`, `locked_by`, `dedup_key`,
  `last_error` (a code, never a message), `created_at`, `updated_at`, `finished_at`. Partial indexes: due pending per
  queue, running per lease end, finished for pruning, and a partial unique `(queue, dedup_key)` over pending and
  running jobs.
- Claim: one `UPDATE … FROM (SELECT … FOR UPDATE SKIP LOCKED LIMIT n)` that takes due pending jobs and running jobs
  whose lease ended, increments `attempts` and sets the lease. `attempts` is the fencing token: every completion is
  `WHERE id = $1 AND status = 'running' AND attempts = $claimed`, so a worker whose lease was taken over cannot
  overwrite the newer attempt.
- A job whose lease ended with no attempts left is failed with `jobs.lease_expired` before claiming.
- Retry delay `min(max, base * 2^(attempt-1))`, reduced by up to 20 % jitter from an injectable random.
- Handlers: `defineJobHandler({ payload: zodSchema, run })`; the payload is parsed at the boundary (invalid → failed
  `jobs.invalid_payload`, no retry); `run` returns `ok()`, an `Err` (retried) or `failJob(code)` (no retry), and may
  ask for its own delay; a throw is retried as `jobs.handler_threw` and logged.
- Worker: `runJobWorker({ db, config, handlers, signal })` loop with per-queue concurrency, poll interval, lease
  heartbeat, pruning on an interval, and on abort a grace period after which unfinished jobs are released (attempt
  given back). `runJobWorkerProcess({ config, handlers })` wires SIGTERM/SIGINT, opens and closes the database,
  sets the exit code.
- Testing: `runDueJobs` runs every due job once, in-process, with the same code path as the worker.
- Deploy: `@softure-ai/jobs` in the app's dependencies adds `scripts/worker.ts`, its esbuild bundle `worker.mjs` in
  the image and a `worker` service (same image, `node worker.mjs`, health check disabled, after `migrate`).

## Risks

- PGlite has one connection, so `SKIP LOCKED` cannot be exercised concurrently in unit tests; the fencing and lease
  paths are tested by simulating a second claim after the lease end (clock moved), which is the case that matters.
- A handler can run twice (lease expiry, crash after the side effect, release on shutdown): at-least-once. The README
  says handlers must be idempotent.
- `deploy` is also changed by PR #470 (secrets per environment); a conflict in the compose template or README is
  resolved at merge.
