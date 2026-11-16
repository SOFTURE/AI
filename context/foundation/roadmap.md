---
project: "SOFTURE AI"
roadmap: runtime-providers
version: 1
status: active
prd_version: 2
created: 2026-11-16
updated: 2026-11-16
---

# Roadmap runtime-providers: one package, two hosts (Node on a VPS, Cloudflare Workers)

> The owner's goal (2026-11-16): every SOFTURE building block exposes one abstraction, and the app's configuration
> picks where it runs: a Node process on a VPS (today's path) or Cloudflare Workers, with Azure as a later provider.
> An app moves between hosts by configuration, not by code, and the user of an app decides where to host it. The
> first adopting app runs on Cloudflare.
>
> Run-wide decisions (owner and coordinator, 2026-11-16):
> - **Postgres on every host.** On Cloudflare the database is a managed EU Postgres reached through Hyperdrive. No
>   D1 support: a second SQL dialect would double every module's schema and query code.
> - **Runtime and host are two axes.** `runtime` (`node` or `workers`) decides which APIs a package may use; `host`
>   (`vps` or `cloudflare`, later `azure`) decides how the app is built, deployed, scheduled and backed up. A package
>   exposes one interface and picks its adapter from the config; an app never imports a host-specific entry by hand.
> - **Node stays the default and is not changed in behaviour.** Every existing app keeps working without touching
>   its config; each item adds the Workers path next to the Node one and keeps the Node tests as they are.
> - Azure is out of scope here: the contract leaves room for it (`host: "azure"`), and no item builds it.
>
> Run-wide orders (read by orchestrators):
> - The sessions of the adopting app's project carry this roadmap and change the packages directly (owner,
>   2026-11-16): gaps found on the way become items here, not issues. Issues keep driving the rest of the work in
>   this repository (`autonomy.source: "issues"`); the issue queue and this roadmap run side by side.
> - Parallelism: up to 4 at once (`workflow.json` → `worktree.maxParallel`). RP-1 goes first: every other item
>   builds on its contract.
> - Process: every item runs the full softure chain; skipping research or framing is justified in `change.md`.
> - Merging: master only on a conflict (`AGENTS.md`, "Merging").
> - Release: each item bumps the packages it changes; RP-11 releases them through the release pipeline
>   (`release.owner: false`). No test or CI job calls Cloudflare or any paid service: Workers run locally in workerd
>   (`wrangler dev` / Miniflare) against a Postgres service container.
> - Archive roadmap: at the end.

## At a glance

| ID | Change | Outcome | Depends on | Mode | Status |
| --- | --- | --- | --- | --- | --- |
| **RP-1** | `runtime-platform-contract` | `platform: { runtime, host }` in core's config, a module's declared runtimes checked at startup, and a repository guard that keeps Workers entries free of Node-only APIs | — | autonomous | done |
| **RP-2** | `db-workers-connection` | `@softure-ai/db` opens a per-request Postgres connection on Workers (Hyperdrive binding), keeps the pooled handle on Node, and never reads migration files at runtime on Workers | RP-1 | autonomous | done |
| **RP-3** | `auth-workers-password` | `@softure-ai/auth` runs on Workers: scrypt stays (workerd provides it) with a default cost that fits the 128 MB isolate, a login rehashes into the runtime's cost, and the auth entries are declared Workers-safe | RP-1 | autonomous | done |
| **RP-4** | `jobs-scheduled-tick` | `@softure-ai/jobs` runs due jobs from one `runJobsTick` shared by the Node worker loop and a Workers `scheduled()` handler (Cron Trigger), with health from a database heartbeat | RP-1, RP-2 | autonomous | ready |
| **RP-5** | `security-workers-fetch` | `@softure-ai/security` guarded outbound requests and client-address checks run on Workers with the same refusals as on Node (resolved addresses checked before the request, where workerd takes no socket `lookup`) | RP-1 | autonomous | done |
| **RP-6** | `observability-workers` | `@softure-ai/observability` gets a Workers entry: structured logs and spans sent over OTLP with `fetch`, flushed through `waitUntil`, under the same service naming as on Node | RP-1 | autonomous | ready |
| **RP-7** | `modules-workers-sweep` | every other runtime module (files, mailing, mcp-access, billing, waitlist, privacy, connections, agent-ready, analytics, feature-switches, metering, alerts, seo, blog, pwa) passes the Workers guard: R2 through the S3 driver, DNS checks over DNS-over-HTTPS, no filesystem on the request path | RP-1 | autonomous | ready |
| **RP-8** | `deploy-cloudflare-target` | `@softure-ai/deploy` gets `host: "cloudflare"`: `init` writes `wrangler.jsonc` and an OpenNext build, a reusable workflow migrates from CI and runs `wrangler deploy`, and `verify` and the release report work as on the VPS | RP-2, RP-4 | autonomous | ready |
| **RP-9** | `backup-cloudflare-host` | `@softure-ai/backup` backs up a managed Postgres without a server: a scheduled workflow dumps, encrypts with age, uploads to R2 and records the run in `backup.runs` | RP-8 | autonomous | ready |
| **RP-10** | `example-on-workers` | the example app runs unchanged on both hosts: CI builds it with OpenNext and runs its e2e in workerd against Postgres, next to the existing Node e2e | RP-2, RP-3, RP-4, RP-5, RP-6, RP-7 | autonomous | ready |
| **RP-11** | `runtime-providers-release` | the changed packages are released, `docs/07-runtime-providers.md` is the adoption guide (Node to Cloudflare and back), and the roadmap is archived | RP-8, RP-9, RP-10 | autonomous | ready |

## Order

1. **RP-1** first: the config contract and the guard every other item tests against.
2. **RP-2**, **RP-3**, **RP-5**, **RP-6**, **RP-7** in parallel once RP-1 is on `master` (disjoint packages).
3. **RP-4** after RP-2 (its tick opens the database per run on Workers).
4. **RP-8** after RP-2 and RP-4 (the deploy migrates from CI and wires the Cron Trigger).
5. **RP-9** after RP-8; **RP-10** after RP-2 to RP-7.
6. **RP-11** last.

## Items

### RP-1: Runtime and host in the app config
- **Change ID:** `runtime-platform-contract`
- **Status:** done
- **Input:** [`runtime-platform-contract`](../archive/2026-11-16-runtime-platform-contract/change.md)
- **Outcome:** `defineSoftureConfig` takes `platform: { runtime: "node" | "workers", host: "vps" | "cloudflare" }`
  (default `{ runtime: "node", host: "vps" }`, unchanged behaviour); a module definition declares the runtimes it
  supports and the config refuses one that does not support the chosen runtime, naming the module; core's root and
  `next` entries stay Workers-safe; a repository test walks each package's Workers-safe entries (declared in its
  `package.json`) and fails on an import of a Node-only builtin (`node:fs`, `node:child_process`, `node:net` sockets,
  `node:os`, `node:http`) or a Node-only dependency.
- **Owns:** `foundation/core/src/config.ts`, `foundation/core/src/module.ts`, `tests/repo/` (new guard),
  `docs/07-runtime-providers.md` (the matrix, started here).
- **Risk:** medium: every module factory gains a declaration; the default must keep existing apps valid.

### RP-2: Database connections on Workers
- **Change ID:** `db-workers-connection`
- **Status:** done
- **Input:** [`db-workers-connection`](../archive/2026-11-16-db-workers-connection/change.md)
- **Outcome:** with `runtime: "workers"` the database handle is opened per request from the Hyperdrive binding's
  connection string (node-postgres under `nodejs_compat`), closed through `waitUntil`, and never shared across
  requests; `database.handle` and the module adapters get it through one request-scoped accessor that falls back to
  the shared pool on Node; migrations never run at runtime on Workers (the CLI migrates from CI with the direct URL),
  and the startup schema check reads the exported migration list, not the disk. PGlite stays Node-only.
- **Owns:** `foundation/db/src/` (client, shared, configured, migrations entry points).
- **Risk:** high: every module reads the database through this package.

### RP-3: Password hashing and OIDC on Workers
- **Change ID:** `auth-workers-password`
- **Status:** done
- **Input:** [`auth-workers-password`](../archive/2026-11-16-auth-workers-password/change.md)
- **Outcome:** passwords keep working when an app moves hosts: workerd runs `node:crypto` `scrypt`, `createPublicKey`
  and `verify` (measured in RP-5), so the hash format stays `scrypt$…`; the default scrypt cost follows the runtime so
  a hash fits a 128 MB isolate on Workers (OWASP's lower-memory equivalent), a login rehashes into the runtime's cost,
  and the auth entries are declared Workers-safe. (The PBKDF2 format first planned is not needed.)
- **Owns:** `modules/auth/src/server/` (password, session-token, temporary-password, oidc).
- **Risk:** high: a wrong hash comparison locks users out; tests cover cross-format login both ways.

### RP-4: Jobs as a scheduled tick
- **Change ID:** `jobs-scheduled-tick`
- **Status:** ready
- **Input:** [`jobs-scheduled-tick`](../changes/jobs-scheduled-tick/change.md)
- **Outcome:** `runJobsTick({ config, budgetMs })` claims and runs due jobs within a time budget; the Node worker
  loop calls it, and a `createScheduledHandler(config)` for Workers runs it from a Cron Trigger (every minute) under
  `waitUntil`; the worker health becomes a heartbeat row in the jobs schema on Workers (the file on Node stays); a
  job longer than the Workers budget is reported, not cut silently.
- **Owns:** `modules/jobs/src/worker/`, `modules/jobs/src/server/run-due.ts`, a new `workers` entry.
- **Risk:** medium: schedules must neither run twice nor skip when ticks overlap (claims stay transactional).

### RP-5: Guarded outbound requests on Workers
- **Change ID:** `security-workers-fetch`
- **Status:** done
- **Input:** [`security-workers-fetch`](../archive/2026-11-16-security-workers-fetch/change.md)
- **Outcome:** the guarded request, page reader and download run on Workers with the same refusals and codes: workerd
  provides `node:http`, `node:net` and `node:zlib` but refuses the socket `lookup`, so there the resolved addresses are
  checked just before the request (`pinLookup`), inside the callers' time limit; RP-1's guard allows the builtins
  workerd provides. The Node path keeps DNS pinning. (Measured in workerd; a `fetch` rewrite and a CIDR matcher turned
  out unnecessary.)
- **Owns:** `modules/security/src/` (guarded-*, public-address, client-ip).
- **Risk:** medium: Workers cannot pin DNS, so the residual risk (a public name resolving to a private address) is
  documented; Cloudflare's network does not route Workers' `fetch` to private ranges.

### RP-6: Observability on Workers
- **Change ID:** `observability-workers`
- **Status:** ready
- **Input:** [`observability-workers`](../changes/observability-workers/change.md)
- **Outcome:** an `@softure-ai/observability/workers` entry with the same logger API (`createLogger`, error labels,
  levels) and a request wrapper that records a server span and flushes logs and spans over OTLP/HTTP with `fetch`
  under `waitUntil`; the same `OTEL_EXPORTER_OTLP_*` settings and `toServiceName` naming as on Node; nothing leaves
  without an endpoint. The Grafana rules builder gains the Workers liveness signal.
- **Owns:** `foundation/observability/src/` (new `workers/` folder; `node/` unchanged).
- **Risk:** low.

### RP-7: The remaining modules on Workers
- **Change ID:** `modules-workers-sweep`
- **Status:** ready
- **Input:** [`modules-workers-sweep`](../changes/modules-workers-sweep/change.md)
- **Outcome:** each listed module declares `workers` support and passes RP-1's guard: files refuses the local driver
  on Workers and saves through the S3 driver to R2 with web streams; mailing's DNS checks go over DNS-over-HTTPS on
  Workers; filesystem reads leave the request path (CLIs keep them); `node:crypto`, `node:dns`, `node:net` and
  `node:http` imports stay (workerd provides them, RP-5), only socket options and filesystem use change. A module that cannot run on Workers says so in its
  declaration and in the matrix.
- **Owns:** `modules/*/src` of the listed modules (not auth, jobs, security, ops, backup).
- **Risk:** medium: broad but shallow; one module per commit.

### RP-8: Deploying to Cloudflare
- **Change ID:** `deploy-cloudflare-target`
- **Status:** ready
- **Input:** [`deploy-cloudflare-target`](../changes/deploy-cloudflare-target/change.md)
- **Outcome:** `softure-deploy init --host=cloudflare` writes `wrangler.jsonc` (Hyperdrive, R2, Cron Trigger,
  `nodejs_compat`, EU placement hints) and the OpenNext build config; a reusable `deploy-cloudflare.yml` builds,
  migrates with the direct database URL from the GitHub Environment, uploads secrets with `wrangler secret bulk`,
  deploys with `wrangler deploy` and runs `softure-deploy verify`; rollback is `wrangler rollback`; the VPS target is
  unchanged. Tests run the workflow's steps against a fake `wrangler`.
- **Owns:** `tools/deploy/src/` (init, a cloudflare target), `.github/workflows/deploy-cloudflare.yml`.
- **Risk:** high: the production path of every Cloudflare app; secrets stay in the GitHub Environment.

### RP-9: Backups without a server
- **Change ID:** `backup-cloudflare-host`
- **Status:** ready
- **Input:** [`backup-cloudflare-host`](../changes/backup-cloudflare-host/change.md)
- **Outcome:** a reusable scheduled workflow runs `pg_dump` against the managed Postgres, encrypts with age to the
  app's recipient, uploads to R2 with the write-only token and records the run in `backup.runs`; the weekly verify
  restores from R2 into a throwaway database as today; the status card and gauges read the same table.
- **Owns:** `modules/backup/src/`, `.github/workflows/` (backup workflow for the cloudflare host).
- **Risk:** medium.

### RP-10: The example app on Workers
- **Change ID:** `example-on-workers`
- **Status:** ready
- **Input:** [`example-on-workers`](../changes/example-on-workers/change.md)
- **Outcome:** `examples/` builds with OpenNext and runs in workerd (`wrangler dev`) against a Postgres service
  container with `platform: { runtime: "workers", host: "cloudflare" }`; the existing e2e suite runs against it in a
  CI job beside the Node run, and only the config differs between the two.
- **Owns:** `examples/`, `.github/workflows/e2e.yml` (a Workers job).
- **Risk:** medium: the proof that one package serves both hosts.

### RP-11: Release and adoption guide
- **Change ID:** `runtime-providers-release`
- **Status:** ready
- **Input:** [`runtime-providers-release`](../changes/runtime-providers-release/change.md)
- **Outcome:** every package changed by RP-1 to RP-10 is released through the pipeline; `docs/07-runtime-providers.md`
  holds the support matrix and the steps to move an app from a VPS to Cloudflare and back (database, secrets, jobs,
  backups, rollback); the roadmap is closed and archived.
- **Owns:** `docs/07-runtime-providers.md`, package versions and changelogs.
- **Risk:** low.
