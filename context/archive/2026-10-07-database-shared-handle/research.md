# Research: database-shared-handle

Input: `change.md`, issue #154, the code on `master` at `a872df1`.

## Where handles are opened today

| Caller | How | Owner of the handle |
| --- | --- | --- |
| Module adapters (`auth`, `mcp-access`, `waitlist`, `billing`, `mailing`, `feature-switches`, `privacy`, `analytics`, `blog` context, blog proxy, blog sitemap) | `getSharedDatabase(config.database.url)` | process-wide map on `globalThis` (`foundation/db/src/shared.ts`) |
| Ops health route | own small pool per URL (`modules/ops/src/next/database.ts`, `max: 2`); refuses `pglite://` unless `ops({ getDatabase })` | ops |
| `softure migrate` | `createDatabase(url)`, closed at the end | the command |
| `softure-blog publish`, `softure-mail campaign` | `createDatabase(url, { max: 1 })` unless `openDatabase` is injected (tests) | the command |
| Ops scripts (`runOpsScript`) | `createDatabase(url, { max: 1 })` unless `database` is passed | the script |
| Example app `lib/database.ts` | its own `createDatabase(url, { max: 5 })` next to the shared one | the app (a second pool) |

`softure migrate` also runs the app's migration hooks (`app.before`/`app.after`, #153). Hook code that imports the
app's own client opens a second instance in the command process, so the commands need the configured handle too,
not only the server adapters.

## Core cannot name db's types

`@softure-ai/db` depends on `@softure-ai/core`, so `SoftureConfig` cannot import `DatabaseHandle`. Options: an
opaque `() => unknown` validated at runtime by db, or a declaration-merging hook in core that db fills
(`interface SoftureDatabaseHandleTypes { handle: DatabaseHandle }`). The second gives apps a type error for a raw
drizzle instance with no runtime cost; the runtime check stays for plain-JS configs.

## Type experiment (TypeScript 6, drizzle-orm 0.45.3)

With `Database = NodePgDatabase & { $client } | PgliteDatabase & { $client }` (schema `Record<string, never>`), a
`drizzle({ client, schema })` instance is not assignable to `Database` or `Queryable`, nor is its transaction
(`dbName: "users"` vs `never`). With a type parameter defaulting to `Record<string, unknown>`, the schema-typed
database, its transaction and a module function taking `Queryable` all type-check; only the reverse (a schemaless
database used as the app's typed one) fails, which is correct: the app wraps the client with its schema instead.
No module source uses the relational `db.query.*` API, so the wider default changes nothing for them.

## PGlite settings after a migration run (measured)

```
before:          TimeZone=Europe/Warsaw, search_path=public, extra   (source = session)
during the run:  + lock_timeout=5s, search_path=softure, statement_timeout=1s
after RESET ALL: TimeZone=Etc/GMT0, search_path=public
```

`pg_settings` lists every session-level setting with `source = 'session'`, and `current_setting(name)` returns a
value `set_config` accepts (units included). Snapshot before, then `set_config(name, old, false)` for changed ones
and `RESET name` for new ones, restores exactly the app's state. The existing migrator test "does not leak a SET
from a migration file into later pooled queries" covers the leak side on both drivers.

## Drivers as dependencies

`createDatabase` already imports both drivers dynamically; only `testing.ts` imports PGlite statically (its own
entry). The emitted `.d.ts` reference `pg` and `@electric-sql/pglite` types, so both stay resolvable for an app
that installs the driver it uses; a missing one fails only the `createDatabase` branch that needs it. In the
workspace, the drivers move to `devDependencies` of `@softure-ai/db` (hoisted for every package's tests);
`tools/deploy` declares its own. The example app needs `pg` in its own dependencies once db no longer brings it.
