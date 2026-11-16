# Plan: runtime-platform-contract (RP-1)

## Approach

Add `platform` to core's config and `runtimes` to the module manifest, check them together in
`defineSoftureConfig`, add a repository guard over Workers-safe entries declared in `package.json`, and start
`docs/07-runtime-providers.md`. Core patch bump (0.2.8): additive and defaulted, so dependants keep their `^0.2` ranges.

## Phases

### Phase 1: platform and runtimes in core (TDD)
- `foundation/core/src/platform.ts`: `SOFTURE_RUNTIMES`, `SOFTURE_HOSTS`, `SUPPORTED_PLATFORMS` (host → runtimes),
  types `SoftureRuntime`, `SoftureHost`, `SofturePlatform`, `SofturePlatformInput`, `resolvePlatform(input)`
  returning `Result<SofturePlatform, string>`, `getModuleRuntimes(manifest)`.
- `manifest.ts`: optional `runtimes` (non-empty, unique).
- `config.ts`: `platform` in input and output (frozen), issue for an unsupported pair, issue per module that does
  not support the runtime: `modules.<i>: module "<id>" does not run on the workers runtime (it supports: node)`.
- Exports from `index.ts`. Fix hand-built configs in two module tests and core's `toEqual`.
- Done when: core tests cover default, host-only, explicit pair, refused pair, refused module, accepted module.

### Phase 2: repository guard (test-after)
- `tests/repo/workers-entries.ts` (walker) + `workers-entries.test.ts`: every `softure.workers` entry exists in
  `exports`, its import graph has no Node-only builtin, and cross-package imports target listed entries; a unit test
  of the walker on fixture sources proves it catches a nested `node:fs` import and a re-export.
- `foundation/core/package.json`: `"softure": { "workers": [".", "./next"] }`.
- Done when: the guard passes on core and fails (seen red) when `node:fs` is imported from `src/index.ts`.

### Phase 3: docs and release prep
- `docs/07-runtime-providers.md`: the two axes, the config, how a module opts in, the guard, the support matrix.
- Core CHANGELOG and version 0.2.8; core README config section mentions `platform`.
- Done when: links and language tests pass.

## Progress

- [x] Phase 1: platform and runtimes in core; core tests 575 passed, sabotage of the runtime check turns 2 red
- [x] Phase 2: guard `tests/repo/workers-entries*.ts`; core lists `.` and `./next`; a planted `node:fs` in `core/src/next/registry.ts` turns it red
- [x] Phase 3: `docs/07-runtime-providers.md`, docs/02 manifest note, core README, CHANGELOG 0.2.8; repo + core tests 1537 passed
