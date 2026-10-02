# Plan: core-contract

Input: change.md, research.md. Complexity: medium (3 phases; one package, no data, design
decisions with real trade-offs already settled in research).

## Goal

`@softure-ai/core` is a workspace package (`foundation/core/`) that builds with `tsc` and exports:

- `Result<T, E>`, `ok`, `err` and the `ErrorCode` template type (`"<module>.<code>"`);
- `Clock`, `systemClock` and a controllable test clock;
- `safeError` (unknown error → a `core.*` code, nothing leaked) and `errorLogLabel`;
- messages: `Locale` (`pl`, `en`), complete core dictionaries, `mergeMessages` for partial
  overrides, `formatMessage` (`{name}` placeholders), `selectPlural` (`Intl.PluralRules`), `getMessage`;
- `defineModule`: a validated manifest (id, version, dependencies, dbSchema, tables, env,
  switches, routes, mount, privacy flags), messages, options schema, migrations location and
  privacy contributors, returning a factory the app calls with options, route and message overrides;
- `moduleManifestSchema` and `toModuleJson` (the `module.json` projection);
- `defineSoftureConfig`: zod-validated `database`, `locale`, `timezone`, `appOrigin`, `modules`,
  with cross-module checks (duplicates, dependencies and their versions, cycles, database needed);
- `@softure-ai/core/next`: `registerSoftureConfig` / `getSoftureConfig` (provisional, ID-1);
- a README with the twelve docs/02 §11 sections, and a test where a dummy module is defined,
  validated and listed in a test app config (roadmap Baseline).

**Out of scope:** `createSoftureHandlers` and `softureMiddleware` (wait for ID-1); running privacy
contributors (privacy module); reading migration files (FD-4); a `softure doctor` CLI; date
formatting helpers.

## Approach

**Starting point:** `foundation/core/` holds only a README and `.gitkeep` files (research §Current
state). The template (`templates/package/`) and `tests/repo/packages.test.ts:56-110` define the
package shell. FIRE gives the result shape, the error scrubbing and the plural rule.

**Chosen:** a dependency-light package (zod only), pure functions, the TS manifest as the runtime
source of truth with a checked `module.json` projection, and a `globalThis` registry in `next/`.
Rejected: `module.json` imported at runtime (breaks `rootDir: src` and client bundles, research
answer 2); explicit config import in package actions (a package cannot import the app's file);
the `semver` package (one more dependency for four range forms).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Result shape | `{ ok: true; value: T } \| { ok: false; error: E }` | FIRE's `{ ok, error }` shape plus a value | research |
| Error codes | `` `${string}.${string}` `` namespaced by module id | docs/02 §6, template contract.ts | research |
| Config failures | `defineSoftureConfig` and module factories throw `SoftureConfigError` with every issue listed | invalid config is a deployment bug found at startup (docs/02 §7); exceptions are for bugs (AGENTS.md) | plan |
| Manifest source of truth | TS manifest authoritative; `module.json` checked via `toModuleJson` | keeps `tsc` build and bundles intact | research |
| Registry | `globalThis[Symbol.for("@softure-ai/core/config")]`, provisional | survives duplicated module instances; ID-1 confirms | research |
| Version ranges | own matcher: `x.y.z`, `^`, `~`, `*`, `?` suffix = optional | four forms, no extra dependency | research |
| Locales | `["en", "pl"]` | docs/02 §6 decision | research |
| Plural | `Intl.PluralRules` with `{ one, few?, many?, other }` forms | generalises FIRE `plural.ts` without Polish code | plan |
| safeError output | `err("core.database_failed" \| "core.unexpected")`, copy in dictionaries | docs/02 §6, no copy in code | research |
| Privacy contract | flags in manifest must match the contributor functions given | a flag without code (or code without a flag) is a silent GDPR gap | plan |

**Critical details:**
- Caret on `0.x`: `^0.1.0` means `>=0.1.0 <0.2.0`, and `^0.0.3` means exactly `0.0.3` (npm rules).
  Every package is `0.x` today, so this is the common case, not an edge case.
- Tests must not contain Polish strings (language gate); they read them from `coreMessages.pl`.
- Pure functions with no top-level side effects: `sideEffects: false` lets UI bundles drop zod.

## Phase 1: Package shell and primitives

**Discipline:** TDD. **Files:** `foundation/core/{package.json,tsconfig.json,tsconfig.build.json}`,
`src/index.ts`, `src/result.ts`, `src/clock.ts`, `src/safe-error.ts`, `src/i18n.ts`,
`src/messages/{en,pl,index}.ts`, `tests/{result,clock,safe-error,i18n}.test.ts`, `package-lock.json`;
remove `src/server/.gitkeep`, `src/messages/.gitkeep`, `tests/.gitkeep`.

1. `package.json` from the template: name `@softure-ai/core`, exports `.` and `./next` only (no
   `server`/`ui` entry: core has no server-only or UI code), dependency `zod` `^4.6.5`,
   `"private": true` stays until FD-8 (owner publishes). Template tsconfigs copied as is.
2. `src/result.ts`: `ErrorCode`, `Ok<T>`, `Err<E>`, `Result<T, E extends ErrorCode = ErrorCode>`,
   `ok()` / `ok(value)`, `err(code)`.
3. `src/clock.ts`: `interface Clock { now(): Date }`, `systemClock`, `createTestClock(start: Date)`
   returning `{ now, advance(ms), set(date) }`; `now()` returns a fresh `Date` copy each call.
4. `src/safe-error.ts`: `CoreErrorCode`, `safeError(error: unknown): Err<CoreErrorCode>`
   (Drizzle `Failed query:` prefix and bare `select … from "` → `core.database_failed`, else
   `core.unexpected`), `errorLogLabel(error)` ported from FIRE (class name + SQLSTATE from the
   error or its `cause`).
5. `src/i18n.ts`: `LOCALES`, `Locale`, `isLocale`, `MessageTree`, `DeepPartial<T>`,
   `Dictionaries<T> = Record<Locale, T>`, `mergeMessages(defaults, overrides?)` (deep, per
   locale, only keys present in defaults, inputs untouched), `formatMessage(template, params?)`
   (unknown placeholder stays as written), `selectPlural(locale, count, forms)`,
   `getMessage(tree, "a.b")` (string or `undefined`).
6. `src/messages/`: `en`/`pl` with `errors.database_failed`, `errors.unexpected`; `coreMessages`.

**Tests:** `ok`/`err` narrowing; test clock advance/set and copy isolation; `safeError` on a
Drizzle message, a bare SQL message, a plain error, a non-error value, and `errorLogLabel` with a
SQLSTATE on `cause`, an invalid code, a non-error; `mergeMessages` with no overrides, a nested
partial override, an unknown key, inputs not mutated; `formatMessage` with params, a missing
param, no params; `selectPlural` for `pl` at 0, 1, 2, 5, 12, 22 and `en` at 0, 1, 2;
`getMessage` hit and miss; every `core.*` code has copy in both dictionaries.

**Done when:**
- Automated: the new tests fail before the sources exist and pass after.
- Automated: `npm run build` emits `foundation/core/dist/index.js` and `index.d.ts`.
- Automated: Gates green (typecheck, lint, test).

## Phase 2: Module contract

**Discipline:** TDD. **Files:** `src/version-range.ts`, `src/manifest.ts`, `src/module.ts`,
`src/config-error.ts`, `src/config.ts` (types only), `src/index.ts`,
`tests/{version-range,manifest,module}.test.ts`.

1. `src/version-range.ts`: `isVersion(text)`, `parseVersionRange(text)` →
   `Result<VersionRange, "core.invalid_version_range">` where `VersionRange` carries `optional`,
   `satisfiesRange(version, range)`.
2. `src/config-error.ts`: `class SoftureConfigError extends Error` with `issues: string[]`; the
   message lists every issue on its own line.
3. `src/manifest.ts`: `moduleManifestSchema` (zod): `id` kebab-case; `version` `x.y.z`;
   `dependsOn` id → valid range; `dbSchema` lower-snake identifier or `null`; `tables` unique;
   `env` `{ name (UPPER_SNAKE), required, description }`; `switches` each prefixed `<id>.`;
   `routes` name → path starting with `/`; `mount` `{ kind: "route-handler" | "page" | "middleware", path, export? }`;
   `privacy` `{ exports, deletes }`. Types `ModuleManifest`, `ModuleManifestInput`.
4. `src/module.ts`: `defineModule(spec)` with `spec = { manifest, messages, options?, migrations?, privacy? }`.
   It validates the manifest (throws `SoftureConfigError` naming the module), requires
   `migrations` when `dbSchema` is set, and requires privacy functions to match the flags. It
   returns a factory `(input?) => SoftureModule` carrying `id` and `manifest`. Input = module
   options (validated by `spec.options`) plus reserved `routes` (partial, only known route names,
   paths start with `/`) and `messages` (partial per locale). `SoftureModule` = `{ id, manifest,
   routes (merged), messages (merged), options, migrations?, privacy? }`, frozen.
   `PrivacyContributor` = `{ exportUserData?(ctx, userId): Promise<Result<unknown>>; deleteUserData?(ctx, userId): Promise<Result<void>> }`
   with `ModuleContext = { db: unknown; clock: Clock; config: SoftureConfig }` (db typed by FD-4).
   `src/config.ts` starts here with only the `SoftureConfig` interface, so `module.ts` imports
   it as a type; phase 3 adds `defineSoftureConfig` to the same file.
   `toModuleJson(moduleOrFactory)` returns the manifest as plain JSON.

**Tests:** versions and ranges (`^0.1.0` vs `0.1.9`/`0.2.0`, `^1.2.3` vs `1.9.0`/`2.0.0`,
`^0.0.3`, `~1.2.3`, exact, `*`, `?` suffix, invalid text); manifest rejects bad id, bad switch
prefix, route without `/`, invalid range; `defineModule` rejects schema without migrations and a
privacy flag without its function; factory merges route and message overrides, rejects an
unknown route name, validates options and lists every issue; `toModuleJson` round-trips through
`moduleManifestSchema`.

**Done when:**
- Automated: the new tests fail before the sources exist and pass after.
- Automated: Gates green (typecheck, lint, test).

## Phase 3: App config, registry and docs

**Discipline:** TDD. **Files:** `src/config.ts`, `src/next/{index,registry}.ts`, `src/index.ts`,
`tests/{config,registry,dummy-module}.test.ts`, `foundation/core/README.md`,
`docs/02-module-standard.md` (§3, §8 notes); remove `src/next/.gitkeep`.

1. `src/config.ts`: `defineSoftureConfig(input)` → frozen `SoftureConfig`. Zod checks
   `locale` ∈ `LOCALES`, `timezone` accepted by `Intl.DateTimeFormat`, `appOrigin` an
   `http(s)` origin without path, `database.url` non-empty (optional), `modules` an array of
   `SoftureModule`. Cross checks: duplicate module ids, duplicate `dbSchema`, two modules on one
   route path, a required dependency missing, a listed dependency outside its range, a cycle, a
   module with `dbSchema` and no `database`. All issues go into one `SoftureConfigError`.
   Also `sortModulesByDependencies(modules)` (dependencies first, listed order breaks ties) and
   `getModule(config, id)`.
2. `src/next/registry.ts`: `registerSoftureConfig(config)`, `getSoftureConfig()` (throws an
   `Error` that names `registerSoftureConfig` when nothing is registered), `clearSoftureConfig()`
   for tests; stored under `Symbol.for("@softure-ai/core/config")` on `globalThis`.
3. `README.md`: twelve §11 sections adapted to core (what it provides, install, config type and
   example, the registry as "mounting", no migrations/env/switches/appearance, copy keys, privacy
   contributor contract as hooks/GDPR, limitations incl. provisional registry).
4. `docs/02-module-standard.md`: §3 says `module.json` is the checked projection of the TS
   manifest (`toModuleJson`); §8 names the registry functions and that ID-1 confirms them.

**Tests:** config accepts a minimal valid input; rejects bad locale, bad timezone, origin with a
path, duplicate ids, missing dependency, version outside range, optional dependency absent (ok)
and present at a wrong version (error), cycle, schema without database; `sortModulesByDependencies`
order; registry throws before registration, returns the registered config, survives a second
copy of the key (reads `globalThis` directly); dummy module: two modules (one depending on the
other) defined, validated, listed, found with `getModule`, and its `module.json` projection
equals the manifest.

**Done when:**
- Automated: the new tests fail before the sources exist and pass after.
- Automated: the dummy module test defines, validates and lists a module in a test app config.
- Automated: `npm run build` emits `dist/next/index.js`; links in README and docs pass the link test.
- Automated: Gates green (typecheck, lint, test).

## Risks and rollback

- Contract mistakes surface in FD-4/FD-5 → the package is `private` and unpublished until FD-8,
  so a follow-up change can reshape it without a release. Revert: drop the phase commit.
- Registry choice wrong for Next → isolated in `next/`; ID-1 replaces it without touching modules.
- Lockfile conflict with FD-2 → take master's lockfile, `npm install`, commit (roadmap rule).

## Decisions (auto)

- Complexity → medium, three phases, no split (one package, each phase green on its own).
- Core exports `.` and `./next` only → no server-only or UI code in core (template entries would be empty placeholders).
- Config failures throw `SoftureConfigError` → startup misconfiguration is a deployment bug; an issue list serves the future `softure doctor`.
- Unknown placeholder in `formatMessage` stays visible → a visible bug beats a crash in render.
- `"private": true` stays → FD-8 is the owner's publish item; FD-2 handles packaging.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Package shell and primitives

#### Automated
- [x] 1.1 The phase 1 tests fail before the sources exist and pass after — e5b3c55
- [x] 1.2 `npm run build` emits `foundation/core/dist/index.js` and `index.d.ts` — e5b3c55
- [x] 1.3 Gates green (typecheck, lint, test) — e5b3c55

### Phase 2: Module contract

#### Automated
- [ ] 2.1 The phase 2 tests fail before the sources exist and pass after
- [ ] 2.2 Gates green (typecheck, lint, test)

### Phase 3: App config, registry and docs

#### Automated
- [ ] 3.1 The phase 3 tests fail before the sources exist and pass after
- [ ] 3.2 The dummy module test defines, validates and lists a module in a test app config
- [ ] 3.3 `npm run build` emits `dist/next/index.js`; README and docs links pass the link test
- [ ] 3.4 Gates green (typecheck, lint, test)
