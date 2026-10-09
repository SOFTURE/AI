# @softure-ai/core

The contract every SOFTURE module stands on. Standard:
[docs/02-module-standard.md](../../docs/02-module-standard.md).

## 1. What it provides

The app configuration (`defineSoftureConfig`), the module contract (`defineModule`), `Result`
with namespaced error codes, an injectable `Clock`, `pl`/`en` messages with partial overrides,
and `safeError` with `PublicError`. `@softure-ai/core/cli` loads the app's config for the modules' command-line tools.

## 2. Installation

```bash
npm install @softure-ai/core
```

Node ≥ 22, ESM only. The only runtime dependency is `zod`.

## 3. Configuration

```ts
interface SoftureConfigInput {
  database?: {                       // required once any module has a dbSchema
    url: string;
    handle?: () => DatabaseHandle | Promise<DatabaseHandle>; // the app's own handle, see below
  } | null;
  locale: "en" | "pl";
  timezone: string;                  // IANA zone, e.g. "Europe/Warsaw"
  appOrigin: string;                 // http(s) origin without a path
  origins?: {                        // read by resolveAppOrigin, see "Request origins" below
    trustedOrigins?: string[];       // other origins the app is served under (at most 16)
    trustRequestHost?: boolean;      // trust Host for any host (default false)
  };
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

An empty `database.url` is not one of those problems. `next build`, a Docker builder stage running
`--export-migrations` and other build steps import the config without `DATABASE_URL`, so
`DATABASE_URL ?? ""` defines a valid config there; the first connection (`createDatabase` and
`getSharedDatabase` in `@softure-ai/db`, `softure migrate`, the module CLIs and the health route)
refuses the empty URL and names the setting. No placeholder URL is needed for a build.

`database.handle` is for an app that already has its own database client: every module, the
health route and the package commands then use that one handle instead of opening a second one on
`url` (with `pglite://`, a second instance on the same directory corrupts it). It is a function,
called on first use and never by `defineSoftureConfig`, and it must return the app's process-wide
handle; wrap a client with `createPostgresHandle(pool)` or `createPgliteHandle(client)`. Details and
the alternative (the app builds on the shared handle): `@softure-ai/db` README §3, "One handle per
process".

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

### Request origins

Behind a proxy `request.url` names the server's listening address (`http://0.0.0.0:3000`), so a module that builds an
absolute URL for a request (auth's login redirect, agent-ready's documents, mcp-access's OAuth URLs, analytics' channel
redirect) reads the origin from headers, with one rule from core:

```ts
import { getTrustedOrigins, readRequestHost, readRequestOrigin, resolveAppOrigin } from "@softure-ai/core";

readRequestHost(request);                          // first Host value, else the URL's host; lowercased
readRequestHost(request, { forwardedHost: true }); // first X-Forwarded-Host value first
readRequestOrigin(request);                        // X-Forwarded-Proto when http(s), else the URL's scheme; null for a bad host
getTrustedOrigins(config);                         // appOrigin, then origins.trustedOrigins
resolveAppOrigin(config, request);                 // the app origin to build URLs on for this request
```

`resolveAppOrigin` answers, in order:

1. the request's origin read with `X-Forwarded-Host` (a proxy that rewrites `Host` names the public host there), when
   it is one of `getTrustedOrigins(config, extra)`;
2. with `origins.trustRequestHost`, the request's origin read from `Host`, whatever the host: for one image served
   under origins nobody lists (a test stack on another port), behind a proxy that passes `Host` through and refuses
   hosts it does not serve;
3. `appOrigin`.

`X-Forwarded-Host` only ever picks a listed origin: a client can send it through a proxy that keeps it. An app on two
hosts (product on `https://app.example.com`, site on `https://example.com`) lists the second once,
`origins: { trustedOrigins: ["https://example.com"] }`, and every module follows. A response built on the result is
cached per `Host`, `X-Forwarded-Host` and `X-Forwarded-Proto` (`Vary`). `parseOrigin(value)` is the strict origin check
the rule uses: exactly `http(s)://host[:port]`, a trailing `/` allowed.

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
- `selectPlural(locale, count, { one, few, many, other })` uses `Intl.PluralRules`, built once per
  locale and reused.
- `getMessage(dictionary, "errors.unexpected")` reads a dotted path.
- Core's own keys (`coreMessages`): `errors.database_failed`, `errors.unexpected`, the copy for
  the `core.database_failed` and `core.unexpected` codes.

**Errors as values.** `Result<T, E>` is `{ ok: true, value } | { ok: false, error }`, built with
`ok(value)` / `ok()` and `err("module.code")`. Codes are namespaced by module id
(`` `${string}.${string}` ``); the UI translates them through messages.
`safeError(error)` turns a caught error into `core.database_failed` (a Drizzle `Failed query:` or a
bare SQL statement) or `core.unexpected`, so no SQL or parameter reaches a caller.
`errorLogLabel(error)` gives a log line with the error class and SQLSTATE only, never the text.

A message written for the user on purpose ("This plan has ended; pick another one.") travels as a
`PublicError`: `getPublicMessage(error)` returns its message, and `null` for every other error, so the
pass-through is one line and nothing else slips out:

```ts
import { getPublicMessage, PublicError, safeError } from "@softure-ai/core";

// domain code
if (plan.endedAt !== null) throw new PublicError("This plan has ended; pick another one.");

// where the error is caught (an MCP tool, an action)
} catch (error) {
  return { text: getPublicMessage(error) ?? t(safeError(error).error) };
}
```

`isPublicError` recognises one from another copy of core too (a registry symbol, not `instanceof`).
`safeError` itself still answers `core.unexpected` for it, since callers switch on its two codes.

**Time.** Server code receives a `Clock` (`ModuleContext.clock`) instead of calling `new Date()`.
`systemClock` is the real one; `createTestClock(start)` has `advance(ms)` and `set(date)`.
A whole test run can also move to another day without code changes: `TEST_TODAY=YYYY-MM-DD` with the
`@softure-ai/testing/vitest-setup` setup file shifts the global `Date` (and so `systemClock`) to that
day while time keeps running ([`@softure-ai/testing`](../testing/README.md)). The same setup file pins
the tests to a zone with a negative offset, so a date computed without an explicit zone fails there.

**Calendar days.** "Today" is a day in a zone, never in the process zone: on a server in UTC an evening
in New York is already tomorrow. `toCalendarDay(instant, timeZone)` returns the `YYYY-MM-DD` day of an
instant in an IANA zone, and `getCalendarDay(clock, timeZone)` today's day from a `Clock`; pass the
app's `timezone` from the config. Both throw a `RangeError` for an invalid date or an unknown zone.

```ts
getCalendarDay(context.clock, config.timezone); // "2026-10-08"
```

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
- No date or number formatting helpers beyond the calendar day; apps use `Intl` with `config.locale` and `config.timezone`.
