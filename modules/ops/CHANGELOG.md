# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/ops`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`ops@x.y.z`).

## 0.2.2

- The content of 0.2.1, which was never published: its release stopped at the gates (ESLint ran out of memory in
  `release.yml`) before publishing, and a tag is never moved.

## 0.2.1

- **Build info (#878):** `createBuildInfoRoute()` from `@softure-ai/ops/next` answers the release
  (`SOFTURE_RELEASE`, read per request), the commit and build time (`SOFTURE_BUILD_COMMIT`, `SOFTURE_BUILD_TIME`) and
  the process start as public JSON, never cached; `withBuildInfo(nextConfig)` from the new entry
  `@softure-ai/ops/next-config` inlines the commit and the build time at `next build`. An optional `changelog` provider
  adds the app's changelog. Without Next: `readBuildInfo()` and `createBuildInfoResponse()` from
  `@softure-ai/ops/server`, type `BuildInfo`. README "Build info".
- Migration: nothing to do. To use it, wrap the config with `withBuildInfo`, mount
  `app/api/health/build/route.ts` with `export const GET = createBuildInfoRoute()`, set `SOFTURE_RELEASE: ${TAG}` on the
  app service and `ARG SOFTURE_BUILD_COMMIT` before `npm run build` in the Dockerfile (both written by
  `softure-deploy init` from the next `@softure-ai/deploy`), then set `build-info-path` in the deploy workflow.

## 0.2.0

- **Breaking (#446):** the built-in `pl` dictionary is gone; English is the only built-in copy and the fallback for
  every other locale, which is now any BCP 47 tag. Migrate: an app that shows Polish keeps its own translation and
  passes it as the overrides for its locale, `ops({ messages: { pl: myTranslation } })`; a key it leaves out reads
  English.
- README: `softure-deploy run --local <script>` runs an ops script on this machine against `DATABASE_URL`.

## 0.1.10

- An ops script's `run` gets a third argument, `{ commit }` (`OpsRunContext`): false on a dry run. A script that
  writes to a second database it opens itself rolls that one back on a dry run too. Scripts with `run(tx, args)`
  are unchanged (#376).

## 0.1.9

- `runOpsMain(script, configModule)` in `@softure-ai/ops/scripts`: the whole entry of an ops script. It finds the
  config in the module as it arrives (the config, `{ default }`, `{ default: { default } }` when `tsx` loads
  `softure.config.ts` as CommonJS in an app without `"type": "module"`, or `{ config }`), runs the script with
  `process.argv.slice(2)` and sets `process.exitCode`, with no top-level `await`. An entry is now
  `void runOpsMain(script, configModule)` instead of an unwrap cast and a `.then` block.

## 0.1.8

- `createHealthResponse(config)` in `@softure-ai/ops/server`: what `GET /api/health` answers, as a plain call
  without Next, a request scope or the config registry. `GET` is now `connection()` plus this function; its answer is
  unchanged. `closeHealthDatabases()` is exported from `@softure-ai/ops/server` too (and still from `/next`).
- README § 4 "Testing the route": test the answer through `createHealthResponse`; calling `GET` itself in Vitest
  needs `server.deps.inline` for `@softure-ai/*` and a `next/server` mock with a no-op `connection`, both since 0.1.6.

## 0.1.7

- **Behaviour change:** `GET /api/health` fails its `database` check (`ops.database_missing`, 503) when the config has no database, for example when `DATABASE_URL` is unset at run time. An app without a database sets `ops({ requireDatabase: false })` to keep the previous answer.

## 0.1.6

- `recipes/initdb/01-roles.sql` keeps a role that exists (re-runnable; `SOFTURE_MIGRATOR_ROLE` may name the app's own migration role) and installs an event trigger that keeps ledger tables (`SOFTURE_LEDGER_SCHEMAS`, default `softure,drizzle`) read-only for the app role.
- `recipes/existing-database.sql` leaves the app's schemas (`SOFTURE_APP_SCHEMAS`, default `public,drizzle`) to their owner and takes write privileges on ledgers back from the app role.
- Ops scripts: keys listed in `secrets` also come as `--<key>-file=<path>` or `--<key>-file=-` (stdin).
- `GET /api/health` calls `connection()`, so it is dynamic by its own code; `next` is an optional peer. A Vitest test
  that calls `GET` needs `server.deps.inline` and a `connection` stub (see 0.1.8 for the recipe and for a handler that
  needs neither).
- The health route and ops scripts use the configured database handle.
