# Research: core-contract

Input: change.md, roadmap FD-3, research.sources (`docs/`, `../../FIRE_TRACKER/`). Depth: normal.
Snapshot: be98178 on claude/fd-3-core-contract-7g4u3m, 2026-10-02 11:20 UTC.

## Summary

`foundation/core/` is an empty scaffold today: a README and four `.gitkeep` files, no
`package.json`, so it is not a workspace yet (`foundation/core/README.md:1-20`). Everything the
outcome names is new code. The shape is fixed by docs/02 (§2 layout, §3 manifest, §6 messages,
§7 config, §8 registry, §9 server contract) and by the FD-1 template (`templates/package/`), which
the repository tests already enforce for any new workspace (`tests/repo/packages.test.ts:56-110`).
FIRE_TRACKER gives three things to port: the `{ ok, error }` result shape
(`FIRE_TRACKER/src/app/actions/auth-contract.ts:8`), the error scrubbing in
`src/lib/safe-error.ts` and the plural rule in `src/lib/plural.ts`. Both FIRE helpers hard-code
Polish copy, so they are ported as codes plus `Intl`, not as strings. The two roadmap unknowns are
decided below (provisional registry on `globalThis`; TS manifest authoritative, `module.json` a
checked projection). FD-4 and FD-5 consume this contract, so its surface must be small and stable.

## Current state

- `foundation/core/`: `README.md` (status "wave 0 · not implemented"), `src/{messages,next,server}/.gitkeep`,
  `tests/.gitkeep`. No `package.json`, so `findWorkspaces` does not list it and no test covers it.
- Root workspaces include `foundation/*` (`package.json:6-11`), so adding `foundation/core/package.json`
  makes it a workspace; `npm run build` then builds it in dependency order (`scripts/build-workspaces.mjs`).
- Tooling from FD-1: `tsconfig.base.json` (NodeNext, `strict`, `noUncheckedIndexedAccess`,
  `verbatimModuleSyntax`, custom condition `@softure-ai/source`), typed ESLint with zero warnings
  (`eslint.config.mjs`), Vitest with `TZ=America/New_York`, random order (`vitest.config.mts:9-13,40`).
- Language gate: Polish text is allowed only under `messages/` folders (`scripts/check-language.mjs:29-31`
  and its exemption list). Tests therefore cannot spell Polish words inline; they must read them
  from dictionaries.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Package shell | `foundation/core/package.json`, `tsconfig.json`, `tsconfig.build.json`, `README.md` | becomes a workspace; shape enforced by `tests/repo/packages.test.ts` |
| Result and errors | `foundation/core/src/result.ts`, `src/safe-error.ts` | `Result<T, ErrorCode>`, `safeError`, `errorLogLabel` |
| Clock | `foundation/core/src/clock.ts` | injected `now` (docs/02 §9) |
| Messages | `foundation/core/src/messages/*`, `src/i18n.ts` | dictionaries, partial overrides, interpolation, plural |
| Module contract | `foundation/core/src/module.ts`, `src/manifest.ts`, `src/version-range.ts` | `defineModule`, manifest schema, `dependsOn` ranges |
| Config | `foundation/core/src/config.ts` | `defineSoftureConfig` |
| Next registry | `foundation/core/src/next/*` | config registry read by server actions (docs/02 §8) |
| Lockfile | `package-lock.json` | `zod` dependency and the new workspace link |
| Docs | `docs/02-module-standard.md` §3, §8 | record the two decisions (provisional where stated) |

## Data

None. No tables, no migrations. `defineModule` only records where a module's SQL lives; FD-4
(`db-migrator`) reads it.

## Tests

- Run: `npm test` (all), or `npx vitest run foundation/core` for the package.
- Repository tests that will start covering core automatically: package shape, exports order,
  `tsc` build script, `pl`/`en` key parity when `src/messages/{en,pl}.ts` exist
  (`tests/repo/packages.test.ts:56-110`). The twelve README sections and `module.json` are checked
  only for `modules/*` and the template (`packages.test.ts:44-46,92-98`), not for `foundation/*`.
- No tests exist for core yet. Gaps to fill: all unit tests for the new API.

## Patterns to follow

- Package layout and exports: `templates/package/package.json:16-37` (`@softure-ai/source` → `types` → `default`).
- Messages: `en.ts` is the type, `pl.ts` is `typeof en` (`templates/package/src/messages/pl.ts:1-4`);
  a dictionary pair is exported as `{ en, pl }` (`templates/package/src/messages/index.ts`).
- Error codes are namespaced by module id: `"template-module.not_implemented"` (`templates/package/src/contract.ts:5`).
- Result shape in FIRE: `{ ok: true } | { ok: false; error: string }` (`FIRE_TRACKER/src/app/actions/auth-contract.ts:8`).
- Tests import through the package name, not relative paths (`templates/package/tests/messages.test.ts:2-5`).
- zod is FIRE's validation library (`FIRE_TRACKER/package.json:59`, `zod ^4.5.2`); latest is 4.6.5.

## Prior work

- `context/archive/2026-10-02-monorepo-tooling/` (FD-1): template, export condition, `tsc` builds; L-001.
- `docs/01-module-assessment.md:45`: core = `defineModule`, `defineSoftureConfig`, registry,
  `Result`/codes, `Clock`, i18n, `locale`/`timezone`, GDPR contributor registry; sources:
  the `database?`/`now` convention, `safe-error.ts`, `plural.ts`.
- `context/foundation/roadmaps/roadmap-identity.md:66-90` (ID-1 `next-actions-spike`) will confirm
  or replace the registry choice made here.
- git log: no earlier commit touched `foundation/core/` beyond the scaffold.

## SOFTURE modules

Not applicable: this change builds the base package every module depends on.

## Risks

- **Contract churn** (high impact, medium likelihood): FD-4, FD-5 and every module build on these
  types. Mitigation: a small surface, discriminated unions, and a dummy module test that exercises
  the whole path (define → list → validate).
- **Registry duplication** (medium): Next.js may load a package twice (server and action bundles),
  so a module-level variable would be two registries. Mitigation: store on `globalThis` under a
  `Symbol.for` key; ID-1 measures the real behaviour.
- **Client bundles pulling zod** (low): core is imported by UI packages for messages. Mitigation:
  `sideEffects: false` and per-file ESM, so unused validation code is tree-shaken.
- **Polish text in tests** (certain if ignored): the language gate rejects it. Mitigation: tests
  read Polish strings from the dictionaries.
- **Parallel FD-2** touches the root `package.json`/lockfile and `.github/workflows/release.yml`.
  Collision only on `package-lock.json`; roadmap rule: take master's lockfile, `npm install`, commit.

## Relevant lessons

- L-001: build with `tsc -p tsconfig.build.json`, never a bundler; the `next/` folder may ship
  `"use server"` files later, so the core build must stay `tsc`.

## Answers to unknowns

1. **How server actions read the registered config (docs/02 §8).** Decided (auto, provisional):
   a registry in `@softure-ai/core/next`: `registerSoftureConfig(config)` called once from the
   app's `softure.config.ts`/`instrumentation.ts`, and `getSoftureConfig()` read by shipped
   actions and route handlers. Stored on `globalThis` under `Symbol.for("@softure-ai/core/config")`
   so two copies of the module share it. Explicit import is impossible for a package action: the
   package cannot import the app's `softure.config.ts`. `getSoftureConfig()` before registration
   is a programming error and throws with a message naming the fix. ID-1 confirms or replaces it.
2. **`module.json` vs. the TS manifest (single source of truth).** Decided (auto): the TS manifest
   passed to `defineModule` is authoritative at runtime; `module.json` is its checked JSON
   projection for agents and `softure doctor`. Reason: importing `../module.json` from `src/`
   breaks the `tsc` build (`rootDir: src`, `templates/package/tsconfig.build.json:6`), and reading it
   with `fs` at runtime breaks in client and edge bundles. Core exports `moduleManifestSchema` (zod)
   and `toModuleJson(module)`; a module's test asserts `module.json` equals `toModuleJson(...)`.
3. **What "dependencies" means at config time.** Answered by docs/02 §3: `dependsOn` maps a module
   id to a version range, `?` suffix = optional. `defineSoftureConfig` must reject a missing
   required dependency, a version outside the range, duplicate ids and cycles.
4. **Locale and timezone.** docs/02 §6: both come from `defineSoftureConfig`. Locales are the two
   shipped dictionaries (`pl`, `en`); the timezone is any IANA zone `Intl` accepts.
5. **Where `safeError` copy lives.** FIRE returns Polish strings (`safe-error.ts:41`). Core returns
   codes (`core.database_failed`, `core.unexpected`) with `pl`/`en` copy in core's dictionaries,
   per docs/02 §6 "errors are codes".

## Open questions

- Registry mechanism: **decided** (auto, provisional until ID-1), see answer 1.
- Manifest source of truth: **decided** (auto), see answer 2.
- `createSoftureHandlers` (named in `foundation/core/README.md:15`): **decided** (auto): out of
  scope. The FD-3 outcome does not list it and it depends on ID-1's verdict on route handlers.
- GDPR contributor registry (docs/01:45): **decided** (auto): the contributor *contract* (a module
  declares `exportUserData`/`deleteUserData`) is in scope as "privacy contributors"; collecting and
  running them is the `privacy` module's job (roadmap-engagement).
- Version range syntax: **decided** (auto): `x.y.z`, `^x.y.z`, `~x.y.z`, `*`, each optionally
  suffixed with `?`. Anything else fails validation. A small tested matcher instead of the `semver`
  package keeps core dependency-free apart from zod.
- `../SKILLS/` and `../API/.github/workflows/` research sources: **answered**: not relevant to the
  core contract (release pipeline sources), not consulted.

## Decisions (auto)

- Depth → normal (no data, money or auth; high design risk handled by explicit decisions).
- Registry → `globalThis` + `Symbol.for`, provisional (only option a package action can use).
- Manifest → TS authoritative, `module.json` checked projection (keeps the `tsc` build and bundles intact).
- `createSoftureHandlers` → out of scope (not in the outcome; waits for ID-1).
- Version ranges → own matcher for `x.y.z`, `^`, `~`, `*` (+ `?`) (smallest dependency surface).
