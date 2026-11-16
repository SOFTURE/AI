# 07. Runtime providers: one package, several hosts

An app built from SOFTURE packages runs on a Node process on a server (a VPS) or on Cloudflare Workers, and moves
between them by configuration. This guide describes the contract every package follows and tracks which packages
support which runtime. The work that fills the matrix is the `runtime-providers` roadmap
([`context/foundation/roadmap.md`](../context/foundation/roadmap.md), items `RP-1` to `RP-11`).

## Two axes

- **Runtime** (`node` or `workers`) decides which APIs a package's server code may use. `node` is a long-running
  Node.js process. `workers` is Cloudflare Workers (workerd) with the `nodejs_compat` flag: no filesystem, no child
  processes, no long-running process, an I/O object lives only as long as the request that opened it, and an
  isolate has 128 MB of memory.
- **Host** (`vps` or `cloudflare`) decides how the app is built, deployed, scheduled and backed up: Docker Compose and
  `deploy.sh` on a VPS; `wrangler`, Cron Triggers, Hyperdrive and R2 on Cloudflare.

Supported pairs today: `vps+node` (the default) and `cloudflare+workers`. A new host (Azure is planned) is a new
entry in `SUPPORTED_PLATFORMS` in `@softure-ai/core` plus an adapter in the packages that depend on the host
(deploy, backup, jobs scheduling).

The database is Postgres on every host. On Cloudflare the app reaches a managed Postgres through a Hyperdrive
binding. D1 is not supported: a second SQL dialect would double every module's schema and queries.

## The app's side

```ts
// softure.config.ts
const config = defineSoftureConfig({
  // ...
  platform: { host: "cloudflare" }, // runtime "workers" follows from the host
  modules: [/* ... */],
});
```

Without `platform` the app runs on `vps+node`, exactly as before. `defineSoftureConfig` refuses an unsupported pair
and every listed module that does not run on the chosen runtime, naming the module.

## The package's side

- **A module declares its runtimes** in its manifest: `runtimes: ["node", "workers"]`. A manifest without the key
  runs on Node only, so a module is never assumed Workers-ready.
- **A package declares its Workers-safe entries** in `package.json`:

  ```json
  "softure": { "workers": [".", "./next"] }
  ```

  `tests/repo/workers-entries.test.ts` walks every module reachable from each listed entry (static imports,
  re-exports and literal dynamic imports; type-only imports are skipped) and fails on:
  - a Node builtin outside the `nodejs_compat` set (`WORKERS_BUILTINS` in `tests/repo/workers-entries.ts`: allowed
    are `crypto`, `buffer`, `util`, `events`, `stream`, `path`, `url`, `async_hooks`, `zlib`, `net`, `dns`, `http`,
    `https` and a few more; `fs`, `child_process`, `os`, `module`, `worker_threads` and the rest are refused);
  - a package that needs a Node process (`NODE_ONLY_PACKAGES`);
  - an import of another `@softure-ai/*` entry that its package does not list as Workers-safe.
- **Host-specific code sits behind one interface.** A package picks its adapter from `config.platform`; an app never
  imports a host-specific entry by hand. CLIs (migrations, exports, operator scripts) stay Node-only: they run in CI
  or on the operator's machine, not inside a Worker.
- **Node behaviour does not change** when a package gains a Workers path.

## What workerd provides, measured

Probed in workerd (Miniflare, `nodejs_compat`) for RP-5, so a package does not rewrite what already works:

- `node:crypto` in full: `scrypt` at the default cost, `pbkdf2`, `createPublicKey` (PEM and JWK), `sign`, `verify`.
  A deployed isolate still has 128 MB, which the local runtime does not enforce.
- `node:net` `BlockList` and `isIP`; `node:zlib` streams.
- `node:dns` resolves over DNS-over-HTTPS.
- `node:http` and `node:https` are a wrapper over `fetch`: a 3xx comes back unfollowed with its `Location`, a body
  keeps its `Content-Encoding`, and the `lookup` option is refused (`ERR_OPTION_NOT_IMPLEMENTED`), so a request
  cannot pin the address it checked.
- `node:fs` and `node:fs/promises` (measured for RP-7): a virtual disk with the bundle read-only under `/bundle` and
  a `/tmp` that lasts one request. There is no app folder, so a file the app ships next to its code on Node
  (`.next/BUILD_ID`, a content folder, a font path) is not there. The guard allows the import; code on a request path
  that reads such a file handles Workers itself (files refuses its disk driver, pwa reads `SOFTURE_BUILD_VERSION`,
  OG fonts are given as URLs), and CLIs keep reading files under Node.

## Support matrix

| Package | Node | Workers | Item |
| --- | --- | --- | --- |
| `@softure-ai/core` (`.`, `./next`, `./og`) | yes | yes | RP-1, RP-7 |
| `@softure-ai/db` (`./request`) | yes | yes | RP-2 |
| `@softure-ai/auth` (`.`, `./server`, `./proxy`, `./next`, `./ui`) | yes | yes | RP-3, RP-7 |
| `@softure-ai/jobs` (`.`, `./server`, `./workers`, `./next`, `./ui`, `./react`) | yes | yes | RP-4 |
| `@softure-ai/security` (`.`, `./server`, `./signed-request`, `./readable-text`) | yes | yes | RP-5 |
| `@softure-ai/observability` (`.`, `./workers`) | yes | yes | RP-6 |
| `@softure-ai/agent-ready` (`.`, `./server`, `./next`, `./webmcp`) | yes | yes | RP-7 |
| `@softure-ai/analytics` (`.`, `./server`, `./next`, `./next/channel-keeper`, `./proxy`, `./client`, `./ui`) | yes | yes | RP-7 |
| `@softure-ai/billing` (`.`, `./server`, `./mailing`, `./next`, `./ui`) | yes | yes | RP-7 |
| `@softure-ai/connections` (`.`, `./server`, `./next`, `./ui`) | yes | yes | RP-7 |
| `@softure-ai/feature-switches` (`.`, `./server`, `./next`, `./ui`) | yes | yes | RP-7 |
| `@softure-ai/files` (`.`, `./client`, `./server`, `./next`, `./mcp`) | yes | yes | RP-7 |
| `@softure-ai/mailing` (`.`, `./server`, `./next`) | yes | yes | RP-7 |
| `@softure-ai/mcp-access` (`.`, `./server`, `./tokens`, `./next`, `./ui`) | yes | yes | RP-7 |
| `@softure-ai/metering` (`.`, `./server`) | yes | yes | RP-7 |
| `@softure-ai/privacy` (`.`, `./server`, `./next`, `./ui`) | yes | yes | RP-7 |
| `@softure-ai/pwa` (`.`, `./next`, `./react`) | yes | yes | RP-7 |
| `@softure-ai/seo` (`.`, `./server`, `./proxy`, `./next`) | yes | yes | RP-7 |
| `@softure-ai/waitlist` (`.`, `./server`, `./next`, `./ui`) | yes | yes | RP-7 |
| `@softure-ai/ui` (`.`, `./next`) | yes | yes | RP-7 |
| `@softure-ai/theme-kit` (`.`, `./react`, `./next`) | yes | yes | RP-7 |
| `@softure-ai/alerts` (`.`, `./server`, `./jobs`, `./mailing`, `./next`, `./ui`) | yes | yes | RP-7, RP-4 |
| `@softure-ai/blog` (`.`, `./server`, `./next`, `./ui`, `./proxy`, `./jobs`) | yes | yes | RP-7, RP-4 |
| `@softure-ai/deploy` (`init --host=cloudflare`, the `deploy-cloudflare` action) | yes | yes | RP-8 |
| `@softure-ai/backup` (`host: "cloudflare"`) | yes | planned | RP-9 |

A row turns to `yes` in the item that adds the package's `softure.workers` entries and its module's `runtimes`. Every
module's `./jobs` entry is Workers-safe since RP-4; no `./cli`, `./scripts`, `./stdio` or `./testing` entry is
declared, and neither is jobs' `./worker` (the Node process): they are Node tools.

## Background jobs on Workers

A Worker has no process that loops, so jobs run from a Cron Trigger: `createScheduledHandler` from
`@softure-ai/jobs/workers` is the Worker's `scheduled` export, fired every minute (`"triggers": { "crons":
["* * * * *"] }` in `wrangler.jsonc`). Each firing opens the request database on the Hyperdrive URL from `env` and runs
one `runJobsTick`: due schedules are enqueued, due jobs run up to each queue's concurrency under their leases until
nothing is due or the budget (default 45 s) ends, and the invocation stays alive through `waitUntil` until what it
started has settled. A job still running at the budget is logged as `warn`; one the platform stops loses its lease and
is retried as `jobs.lease_expired`. Ticks that overlap never run a job or a schedule period twice. Health is the row
`jobs.worker_heartbeats` (`checkJobsTickHealth`) instead of the Node worker's file, and pruning runs once an hour.

```ts
// worker.ts (OpenNext's worker wrapped with the jobs tick)
import { createScheduledHandler } from "@softure-ai/jobs/workers";
import handler from "./.open-next/worker.js";
import config from "./softure.config";
import { handlers } from "./src/jobs/handlers";

export default {
  fetch: handler.fetch,
  scheduled: createScheduledHandler({ config, handlers, databaseUrl: (env: Env) => env.HYPERDRIVE.connectionString }),
};
```

## Deploying to Cloudflare

`softure-deploy init --host=cloudflare --domain=<host>` writes `wrangler.jsonc`, `open-next.config.ts`, the
`worker.ts` above (with a database), the migrate script and a caller workflow that runs the
[`deploy-cloudflare`](../.github/actions/deploy-cloudflare/action.yml) action from the `production` environment: it
checks the tag, builds with OpenNext, migrates from the runner with the direct database URL (`MIGRATE_DATABASE_URL`;
the Worker itself goes through Hyperdrive), deploys the Worker with its secrets as one version
(`wrangler deploy --secrets-file`), runs `softure-deploy verify` and, when verify fails, `wrangler rollback`. The
release report is written as on a VPS. Details and the steps `init` prints: the deploy README, "On Cloudflare Workers".

Moving an app from a VPS to Cloudflare:

1. `platform: { host: "cloudflare" }` in `softure.config`; every module the app lists must support `workers`.
2. `init --host=cloudflare --force` (the server files stay in git until the move is done); create the Hyperdrive
   configuration on the managed Postgres and set its ID.
3. Copy the database (`pg_dump` from the server, `pg_restore` into the managed Postgres, or the backup package's
   restore), set the environment's secrets, publish a release.
4. Point the domain at the Worker (the custom domain in `wrangler.jsonc`), then retire the server.

Back to a VPS is the same in reverse: `init --force` without `--host`, `platform` removed, the database copied back.

