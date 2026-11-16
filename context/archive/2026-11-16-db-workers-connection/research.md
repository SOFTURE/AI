# Research: db-workers-connection (RP-2)

## How it works today

- Modules reach the database through `getConfiguredDatabase(config.database)` (`foundation/db/src/configured.ts`):
  the app's `database.handle` when set, else `getSharedDatabase(url)` (`shared.ts`), one promise per URL on
  `globalThis`, opened once by `createDatabase` (`client.ts`: a node-postgres `Pool`, or PGlite) and never closed by
  a server. 16 module adapters (`modules/*/src/next/context.ts`, `ops` health, `blog` proxy and sitemap,
  `mcp-access`, `connections`) call it, all through the package root `@softure-ai/db`.
- The root entry also exports the migration runner, the exporter and `readMigrationFiles`, which import `node:fs`,
  `node:path` and `node:url`; `entry-guard.ts` reads files too. So the root cannot be listed as Workers-safe without
  moving those exports, which would break every app that imports them from the root.
- Migrations run from `softure migrate` (CLI, Node) or `createProcessDatabase` scripts; no module runs them inside a
  request. The integration image exports migrations to SQL at build time (`--export-migrations`).
- `node:async_hooks` `AsyncLocalStorage` is already used by `testing/transaction-guard.ts`; Workers provide it under
  `nodejs_compat`.

## Workers facts

- An I/O object (socket, stream) opened while handling one request cannot be used by another request: a pool kept on
  `globalThis` breaks on the second request ("Cannot perform I/O on behalf of a different request").
- Hyperdrive gives the Worker `env.<BINDING>.connectionString`, a local, pooled endpoint; Cloudflare's guidance is a
  new `pg` client per request, closed in `ctx.waitUntil` after the response. node-postgres runs under
  `nodejs_compat`.
- Bindings live on `env`, passed to `fetch(request, env, ctx)`; they are not known when `softure.config.ts` is
  evaluated, so the URL arrives per request.
- PGlite needs a filesystem for `pglite://<dir>`; it is a dev and test tool and stays Node-only.

## Decisions (auto)

- **A request scope instead of a second API.** `withRequestDatabase({ url, waitUntil }, run)` opens a handle for
  `url` (pool of one), runs `run` inside an `AsyncLocalStorage` scope, and closes the handle through `waitUntil`
  after `run` settles. `getConfiguredDatabase` returns the scope's handle when a scope is active, so every module
  adapter works unchanged. Outside a scope on Workers it throws a message naming `withRequestDatabase`; on Node
  outside a scope nothing changes.
- **A Workers-safe entry `@softure-ai/db/request`.** It exports the scope functions, `getConfiguredDatabase`, the
  handle types and the driver-error helpers; the root re-exports the same functions, so Node apps keep their imports.
  Module adapters switch to `/request` in RP-7 when each module is made Workers-ready.
- **Runtime detection only as a safety net**: `navigator.userAgent === "Cloudflare-Workers"` decides the error
  outside a scope; the config's `platform` stays the source of truth for apps.
- `pglite://` inside a scope is refused with a message that PGlite is Node-only.
