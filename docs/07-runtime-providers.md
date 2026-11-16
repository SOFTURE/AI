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

## Support matrix

| Package | Node | Workers | Item |
| --- | --- | --- | --- |
| `@softure-ai/core` (`.`, `./next`) | yes | yes | RP-1 |
| `@softure-ai/db` (`./request`) | yes | yes | RP-2 |
| `@softure-ai/auth` | yes | planned | RP-3 |
| `@softure-ai/jobs` | yes | planned | RP-4 |
| `@softure-ai/security` (`.`, `./server`, `./signed-request`, `./readable-text`) | yes | yes | RP-5 |
| `@softure-ai/observability` | yes | planned | RP-6 |
| other runtime modules | yes | planned | RP-7 |
| `@softure-ai/deploy` (`host: "cloudflare"`) | yes | planned | RP-8 |
| `@softure-ai/backup` (`host: "cloudflare"`) | yes | planned | RP-9 |

A row turns to `yes` in the item that adds the package's `softure.workers` entries and its module's `runtimes`.
