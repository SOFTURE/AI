# Research: runtime-platform-contract (RP-1)

## How it works today

- `defineSoftureConfig` (`foundation/core/src/config.ts`) parses the input with a zod schema, then runs
  `checkModules` (duplicates, shared schemas, `dependsOn` ranges, single switch/site-URL provider, cycles) and
  `checkDatabase`, and returns a frozen `SoftureConfig`. Nothing in it names a runtime or a host.
- The module manifest (`foundation/core/src/manifest.ts`) is a zod object; `module.json` in every module equals
  `toModuleJson(manifest)` (each module's `tests/module.test.ts`). A new **optional** manifest key keeps every
  `module.json` valid; a defaulted key would change all twenty of them.
- Core's own entries: `.` and `./next` import only `zod` and relative files; `./og` and `./cli` read files
  (`node:fs`, `node:path`, `node:url`). So core's runtime entries are already Workers-safe.
- Hand-built config objects: `modules/connections/tests/postgres.ts` and `modules/alerts/tests/channels.test.ts`
  cast to `SoftureConfig`; `foundation/core/tests/config.test.ts` compares the whole config with `toEqual`.
- Package entries are declared in `package.json` `exports` with a `@softure-ai/source` condition pointing at
  `src/` (used by tests and typecheck), so a guard can resolve the source file of any entry.

## Workers runtime facts (Cloudflare, `nodejs_compat`)

Available: `node:crypto` (hashes, HMAC, random, `timingSafeEqual`, `scrypt`, `pbkdf2`; partial `KeyObject`),
`node:buffer`, `node:util`, `node:events`, `node:stream`, `node:path`, `node:url`, `node:async_hooks`,
`node:string_decoder`, `node:assert`, `node:zlib`, `node:timers`, `node:querystring`, `node:diagnostics_channel`.
Missing or not usable on a request path: a real filesystem (`node:fs` is an in-memory stub), `node:child_process`,
`node:os` host facts, `node:http`/`node:https` servers and agents, `node:net`/`node:dns` the way the security
package uses them, `node:module` `createRequire`, `node:worker_threads`, `node:cluster`, `node:vm`, `node:v8`,
`node:inspector`, `node:readline`, `node:tty`, `node:dgram`, `node:http2`, `node:perf_hooks`.

## Decisions (auto)

- **Two axes, fixed pairs for now.** `platform.host` ∈ `vps | cloudflare`, `platform.runtime` ∈ `node | workers`;
  supported pairs `vps+node` and `cloudflare+workers`. A missing runtime follows the host; a missing platform is
  `vps+node`. Other pairs are refused with the list of supported ones, so `azure+node` later is one table row.
- **Module support is opt-in.** Manifest key `runtimes` (optional, non-empty, unique). Absent = `["node"]`. A
  module adds `"workers"` in the item that makes it safe (RP-2 to RP-7), together with the guard entry below.
- **The guard reads `package.json`.** `"softure": { "workers": ["."] }` lists the export keys that must be
  Workers-safe. `tests/repo/workers-entries.test.ts` walks static imports and re-exports from each listed entry's
  source (type-only imports skipped), fails on a Node-only builtin, and fails on an import of another
  `@softure-ai/*` entry that its package does not list. Core lists `.` and `./next` now.
- No runtime detection at import time: the config is the single source of truth.
