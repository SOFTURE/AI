# @softure-ai/core

**Status:** wave 0 · implemented in FD-3 (`core-contract`), 0.1.4, prepared for its first release (the owner's tag, `scripts/release/README.md`).

The contract every SOFTURE module stands on. Standard:
[docs/02-module-standard.md](../../docs/02-module-standard.md). Sources in FIRE_TRACKER: the
`{ ok, error }` action results, `src/lib/safe-error.ts` and `src/lib/plural.ts`.

## 1. What it provides

The app configuration (`defineSoftureConfig`), the module contract (`defineModule`), `Result`
with namespaced error codes, an injectable `Clock`, `pl`/`en` messages with partial overrides,
and `safeError`. `@softure-ai/core/cli` loads the app's config for the modules' command-line tools.

## 2. Installation

```bash
npm install @softure-ai/core
```

Node ≥ 22, ESM only. The only runtime dependency is `zod`.

## 3. Configuration

```ts
interface SoftureConfigInput {
  database?: { url: string } | null; // required once any module has a dbSchema
  locale: "en" | "pl";
  timezone: string;                  // IANA zone, e.g. "Europe/Warsaw"
  appOrigin: string;                 // http(s) origin without a path
  modules: SoftureModule[];          // a module is enabled by being listed
}
```

```ts
// softure.config.ts
import { defineSoftureConfig } from "@softure-ai/core";
import { registerSoftureConfig } from "@softure-ai/core/next";
import { notes } from "@softure-ai/notes";

const config = defineSoftureConfig({
  database: { url: process.env.DATABASE_URL ?? "" },
  locale: "pl",
  timezone: "Europe/Warsaw",
  appOrigin: process.env.APP_ORIGIN ?? "http://localhost:3000",
  modules: [notes({ limit: 10, routes: { list: "/my-notes" }, messages: { en: { list: { title: "My notes" } } } })],
});

registerSoftureConfig(config);
export default config;
```

`defineSoftureConfig` throws `SoftureConfigError` with every problem listed (`issues`): an
unknown locale or zone, an origin with a path, a module listed twice, two modules on one database
schema, a required dependency missing, a dependency outside its version range (also an optional
one, when listed), a dependency cycle, or a module with a `dbSchema` and no `database`.

A command that never connects loads the config inside `withDatabaseOptional(() => import(...))`:
there a missing, `null` or empty `database.url` gives `database: null` instead of a refusal, also when
a module has a `dbSchema`; a real URL is kept and every other check still runs. The flag is scoped to
that one load, and Node keeps a module's first evaluation, so a process loads the config one way.

`getModule(config, id)` finds an enabled module; `sortModulesByDependencies(modules)` returns the
migration order (dependencies first, listed order otherwise).

**Defining a module** (in a module package):

```ts
import { defineModule, resolveMigrationsDir } from "@softure-ai/core";
import { z } from "zod";
import { en } from "./messages/en.js";
import { pl } from "./messages/pl.js";

export const notes = defineModule({
  manifest: {
    id: "notes", version: "0.1.0", dependsOn: { auth: "^0.1.0" }, dbSchema: "notes",
    tables: ["notes"], env: [], switches: ["notes.read_only"], routes: { list: "/notes" },
    mount: [], privacy: { exports: true, deletes: true },
  },
  messages: { en, pl },
  options: z.object({ limit: z.number().int().positive().default(100) }),
  migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") },
  privacy: { exportUserData, deleteUserData },
  health: checkNotesReady, // optional: (context) => Promise<Result<undefined>>
  // switchReader: optional, only for the app's switch provider (section 7)
  // siteUrls: optional, only for the app's site URL provider (section 7)
});
```

- `resolveMigrationsDir(import.meta.url, "../migrations/")` gives the folder's `file:` URL. Do not
  write `new URL("../migrations/", import.meta.url)` in a module: Next.js (Turbopack) treats that
  literal form as an asset import and fails the app's `next build` on a folder, also from
  `node_modules` (measured in identity ID-1).
- The manifest is checked against `moduleManifestSchema` when the package is imported; a
  `dbSchema` needs `migrations`, and each privacy flag needs its function (and only then).
- The returned factory takes the module's options plus two reserved keys: `routes` (new paths
  for known route names) and `messages` (partial copy per locale). It throws
  `SoftureConfigError` naming the module and every invalid field.
- **`module.json`** is the JSON projection of the TS manifest, which is the source of truth at
  runtime. A module's test keeps them equal:
  `expect(JSON.parse(readFileSync("module.json", "utf8"))).toEqual(toModuleJson(notes))`.
- Version ranges in `dependsOn`: `x.y.z`, `^x.y.z`, `~x.y.z`, `*`, each optionally ending in `?`
  (optional dependency). Caret follows npm on `0.x`: `^0.1.0` is `>=0.1.0 <0.2.0`.

## 4. Mounting

`@softure-ai/core/next` holds the config registry for server actions and route handlers shipped
in module packages, which cannot import the app's `softure.config.ts`:

- `registerSoftureConfig(config)`: call it in `softure.config.ts`, and import that file from
  `instrumentation.ts` (it runs at server start) and from the root layout (`next build` prerenders
  static pages without running instrumentation);
- `getSoftureConfig()`: read it inside package code; it throws when nothing was registered;
- `clearSoftureConfig()`: for tests.

Confirmed by identity ID-1 (`next-actions-spike`): a server action, a route handler and a server
component page shipped in a package all read the registered config, in `next dev` and in
`next build && next start`, installed as a packed copy or linked from the workspace. The rules for
package-shipped Next code are in docs/02 §8. `createSoftureHandlers` and `softureMiddleware` come
with the first module that mounts routes.

`@softure-ai/core/cli` is how a module's command-line tool (`softure migrate`, `softure-mail`,
`softure-blog`) finds the app's config, so the lookup and its messages live once:

- `takeConfigOption(argv)`: takes `--config <file>` or `--config=<file>` out of the arguments;
- `loadAppConfig({ cwd, configPath, appScript })`: imports the `--config` file, or the first of
  `DEFAULT_CONFIG_FILES` (`softure.config.{ts,mts,js,mjs}`) in `cwd`; when Node cannot import it, the
  problem names `appScript.runner` and the `appScript.packageName` README;
- `findDefaultConfig(cwd)` and `loadConfig(path, appScript, { database })`: the two halves on their own;
- `database: "optional"` (default `"required"`) on both loaders: for a command that never connects
  (`softure-blog check`), the import runs inside `withDatabaseOptional`.

Each returns `{ ok: true, … }` or `{ ok: false, problem }`; the tool prefixes the problem with its name.
Node only: the root entry has no `node:` imports.

## 5. Migrations and tables

None. Core owns no database schema. A module points at its SQL folder with
`migrations: { dir: resolveMigrationsDir(import.meta.url, "../migrations/") }`; `@softure-ai/db`
(FD-4) applies the files.

## 6. Environment variables

None. Core reads no environment variables; the app passes values into `defineSoftureConfig`.

## 7. Switches

None of its own. Modules declare theirs in `manifest.switches`, each prefixed with the module id
(`notes.read_only`); the `feature-switches` module manages them.

Core holds the **switch-reader contract**, so a module can read a switch without importing the
module that stores them (feature-switches depends on auth, so auth could not import it back):

```ts
import { readSwitch } from "@softure-ai/core";

const reading = await readSwitch(ctx, "notes.read_only");
const isReadOnly = reading.kind === "value" ? reading.isEnabled : getNotesOptions(ctx.config).readOnly;
```

- `readSwitch(ctx, name)` asks the enabled module that passed `switchReader` to `defineModule`
  and returns `SwitchReading`: `{ kind: "value", isEnabled }`, or `{ kind: "undeclared" }` when no
  module provides a reader or the app did not define that switch there. On `undeclared` the module
  uses its own default.
- A `SwitchReader` is `(context, name) => Promise<SwitchReading>`. It resolves read failures itself
  (a fail mode) and never throws for an unknown name. `@softure-ai/feature-switches` is the provider.
- `defineSoftureConfig` refuses two enabled modules that provide a reader; `findSwitchReader(config)`
  returns the one there is, or `null`.
- `readSwitch` caches nothing: each call is one read by the provider. Ask once per request.

Core also holds the **site-URL contract**, so a module can declare the absolute URLs of its pages
(canonical, Open Graph, JSON-LD, feeds) by the app's canonical rule without importing the module that
owns it (`@softure-ai/seo` is optional for the blog, and a bundler resolves every `import()`):

```ts
import { getSiteUrls } from "@softure-ai/core";

const urls = getSiteUrls(config);
urls.getCanonicalUrl("/notes/first"); // a page: the provider's host and trailing-slash rule
`${urls.origin}/notes/feed.xml`;      // a file: on the site's origin as it is
```

- `getSiteUrls(config)` asks the enabled module that passed `siteUrls` to `defineModule` (a
  `SiteUrlProvider`, `(config) => SiteUrls`); `@softure-ai/seo` is the provider. Without one, `origin`
  is `appOrigin` and `getCanonicalUrl(path)` appends the path to it unchanged.
- `getCanonicalUrl` takes a path starting with a single `/` and throws for anything else.
- `defineSoftureConfig` refuses two enabled modules that provide site URLs; `findSiteUrlProvider(config)`
  returns the one there is, or `null`.

## 8. Appearance

None. Tokens, slots and styles live in `@softure-ai/ui`.

## 9. Copy

- `LOCALES` is `["en", "pl"]`; every module ships both dictionaries complete (`pl.ts` is typed
  `typeof en`).
- `mergeMessages(defaults, overrides)` applies partial overrides per locale; unknown keys and a
  string in place of a group are ignored.
- `formatMessage("{count} of {total}", { count, total })` fills placeholders; a missing value
  stays visible as `{name}`.
- `selectPlural(locale, count, { one, few, many, other })` uses `Intl.PluralRules`.
- `getMessage(dictionary, "errors.unexpected")` reads a dotted path.
- Core's own keys (`coreMessages`): `errors.database_failed`, `errors.unexpected`, the copy for
  the `core.database_failed` and `core.unexpected` codes.

**Errors as values.** `Result<T, E>` is `{ ok: true, value } | { ok: false, error }`, built with
`ok(value)` / `ok()` and `err("module.code")`. Codes are namespaced by module id
(`` `${string}.${string}` ``); the UI translates them through messages.
`safeError(error)` turns a caught error into `core.database_failed` (a Drizzle `Failed query:` or a
bare SQL statement) or `core.unexpected`, so no SQL or parameter reaches a caller.
`errorLogLabel(error)` gives a log line with the error class and SQLSTATE only, never the text.

**Time.** Server code receives a `Clock` (`ModuleContext.clock`) instead of calling `new Date()`.
`systemClock` is the real one; `createTestClock(start)` has `advance(ms)` and `set(date)`.
A whole test run can also move to another day without code changes: `TEST_TODAY=YYYY-MM-DD` with the
`@softure-ai/testing/vitest-setup` setup file shifts the global `Date` (and so `systemClock`) to that
day while time keeps running ([`@softure-ai/testing`](../testing/README.md)).

## 10. Hooks

`ModuleContext` is what every server function of a module receives: `{ db, clock, config }`
(`db` is typed by `@softure-ai/db`). Request scope (cookies, headers) stays in `next/`.

`health` (optional) is the module's readiness probe, a `HealthCheck`:
`(context: ModuleContext) => Promise<Result<undefined>>`. `GET /api/health` of `@softure-ai/ops`
runs it for every enabled module that has one; `ok()` is healthy, an `Err` or a throw is not.
Keep it to one cheap query.

## 11. GDPR

Core collects nothing. It defines the contributor contract a module implements:
`exportUserData(context, userId)` returning `Result<unknown>` and
`deleteUserData(context, userId)` returning `Result<undefined>`, present exactly when the
manifest's `privacy.exports` / `privacy.deletes` flag is true. The `privacy` module runs them.

## 12. Limitations

- The registry in `next/` is provisional until ID-1.
- Versions are plain `x.y.z`; pre-release versions and range forms beyond `^`, `~`, exact and `*`
  are rejected.
- Route maps mix mounted paths and redirect targets, so two modules may share a path; mount
  collisions are left to `softure doctor`.
- No date or number formatting helpers yet; apps use `Intl` with `config.locale` and `config.timezone`.
