# @softure-ai/db

The database layer every SOFTURE module stands on. Standard:
[docs/02-module-standard.md](../../docs/02-module-standard.md) §4.

## 1. What it provides

A pg/PGlite client chosen by URL, a migrator that runs each module's SQL in the module's own
Postgres schema (with a ledger, checksums, a lock, a dry run and adoption of existing tables),
`createTestDatabase` for unit tests, and the `softure migrate` command.

## 2. Installation

```bash
npm install @softure-ai/db drizzle-orm
```

Node ≥ 22, **ESM only**: module packages locate their migrations through `import.meta.url`, which a
CJS bundle (esbuild `--format=cjs`) leaves empty, so `resolveMigrationsDir` throws naming the bundle
format; the app script below also uses top-level await. Bundle migrate scripts with `--format=esm`.
`drizzle-orm` (`^0.45.2`) is a peer dependency, so the app, the modules and
this package share one drizzle.

The drivers are optional peers: install the one the app's URL uses, and only that one goes into the
app image. Each loads only when a URL needs it.

```bash
npm install pg                                   # postgres:// and postgresql://
npm install @electric-sql/pglite                 # pglite:// (dev without a server)
npm install -D @electric-sql/pglite              # a Postgres app's createTestDatabase, --adopt and baseline
npm install -D @types/pg                         # only with skipLibCheck: false
```

| Needs | `pg` (`^8.11.0`) | `@electric-sql/pglite` (`^0.5.0`) |
| --- | --- | --- |
| `postgres://`, `postgresql://` | yes | no |
| `pglite://` | no | yes |
| `createTestDatabase` (`@softure-ai/db/testing`) | no | yes (dev) |
| `softure migrate --adopt`, an app `baseline` (compare against a scratch PGlite) | URL's driver | yes |

A URL whose driver is missing fails at the first connection: `createDatabase: postgres:// URLs need
the "pg" package, which is not installed; …`, with Node's error as `cause`.

**Next.js.** List this package and the driver in `serverExternalPackages`:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  serverExternalPackages: ["@softure-ai/db", "pg"], // or "@electric-sql/pglite" for pglite://
};
```

Bundled, the package's `import()` of each driver and drizzle adapter is resolved at build time, so
`next build` fails with `Can't resolve '@electric-sql/pglite'` in an app without PGlite (drizzle's
adapter imports it statically). External, it loads from `node_modules` at run time, and standalone
output tracing follows the same imports, so `.next/standalone` carries the installed driver and
drizzle and nothing else (the example app installs `pg` only:
[`next.config.ts`](../../examples/next-app/next.config.ts)). The config and the shared handles live on `globalThis`, so this copy and the modules bundled next
to it share them. Hiding the imports from the bundler instead (`turbopackIgnore`) builds, but
tracing skips the driver and the image fails at the first query.

## 3. Configuration

The database URL comes from the app config (`database.url` in `defineSoftureConfig`), usually
`process.env.DATABASE_URL`:

| URL | Driver |
| --- | --- |
| `postgres://…`, `postgresql://…` | node-postgres pool (production) |
| `pglite://<dir>` | PGlite, a real Postgres in-process, data in `<dir>` (dev without a server) |
| `pglite://` | PGlite in memory |

```ts
import { createDatabase, type Queryable } from "@softure-ai/db";

const handle = await createDatabase(config.database.url, { max: 10 }); // max: pg pool size
await handle.db.select().from(notes);   // drizzle
await handle.close();
```

- `DatabaseHandle` is `{ kind: "postgres", db, pool, close } | { kind: "pglite", db, client, close }`.
- `Database<TSchema>` is the drizzle database of either driver; `Queryable<TSchema>` is a `Database`
  or an open transaction, so one helper serves both (`db.transaction(async (tx) => helper(tx))`).
  Without a type argument both accept any schema, so an app database made with
  `drizzle({ client, schema })`, and its transactions, pass to module functions as they are.
- An unsupported scheme throws, naming the scheme only; the URL (and its password) is never
  printed.

### One handle per process

Modules open their database through the config, never on their own: the app's handle when
`database.handle` is set, otherwise one process-wide handle per URL (`getSharedDatabase(url)`). An
app that also has its own client must make sure both are the same handle. A second handle is a second
pool on Postgres; on `pglite://` it is a second PGlite instance on the same directory, which corrupts
it without an error (the next open fails with `could not locate a valid checkpoint record`).

**Either** hand the app's client to the config. The function is called on first use, never while the
config is defined (a build does not connect), and must return the app's one handle:

```ts
// db/client.ts: the app's own client, memoized: `next dev` re-evaluates modules on every change
import { PGlite } from "@electric-sql/pglite";
import { createPgliteHandle, createPostgresHandle, type DatabaseHandle } from "@softure-ai/db";
import pg from "pg";

const cache = globalThis as typeof globalThis & { appDatabase?: Promise<DatabaseHandle> };

export function getAppDatabase(url: string): Promise<DatabaseHandle> {
  cache.appDatabase ??= url.startsWith("pglite://")
    ? createPgliteHandle(new PGlite(url.slice("pglite://".length)))
    : createPostgresHandle(new pg.Pool({ connectionString: url }).on("error", () => undefined));
  return cache.appDatabase;
}

// softure.config.ts
const url = process.env.DATABASE_URL ?? "";
defineSoftureConfig({ database: { url, handle: () => getAppDatabase(url) }, /* … */ });
```

Every module adapter, the ops health route, `softure migrate` (and the app's migration hooks it
runs), `softure-blog`, `softure-mail` and ops scripts then use that handle; a command closes it
when it is done, which writes a `pglite://` directory back.

**Or** build the app's typed drizzle instance over the shared handle, so there is nothing to hand
over:

```ts
import { getSharedDatabase } from "@softure-ai/db";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import * as schema from "./schema";

export async function getDb() {
  const handle = await getSharedDatabase(config.database.url);
  return handle.kind === "postgres" ? drizzlePg({ client: handle.pool, schema }) : drizzlePglite({ client: handle.client, schema });
}
```

`getConfiguredDatabase(config.database)` is what modules call; app code that needs the database
the modules use can call it too. A migration run on a PGlite handle the app shares keeps the app's
session settings (`TimeZone`, `search_path`); only what the run changed is put back.

## 4. Mounting

Nothing to mount. Migrations run as a deploy step:

- **Dev:** `npx softure migrate` finds `softure.config.{ts,mts,js,mjs}` in the working directory
  (or `--config <file>`). The file must be one Node can import: `.js`/`.mjs`, or `.ts` where Node
  strips types (Node ≥ 22.18, relative imports written with `.ts`). Otherwise use the script below.
  The lookup is `@softure-ai/core/cli`'s, shared with `softure-mail` and `softure-blog`.
- **App script and container image:** the app owns a three-line script, which esbuild bundles:

```ts
// scripts/migrate.ts
import { runMigrateCli } from "@softure-ai/db/cli";
import config from "../softure.config";

process.exitCode = await runMigrateCli({ config, argv: process.argv.slice(2) });
```

```dockerfile
# build stage: copy each module's SQL next to the bundle, then bundle the runner
RUN npx tsx scripts/migrate.ts --export-migrations ./softure-migrations
RUN npx esbuild scripts/migrate.ts --bundle --platform=node --format=esm --target=node22 \
      --external:pg --external:@electric-sql/pglite \
      --external:drizzle-orm/pglite --external:drizzle-orm/node-postgres --outfile=migrate.mjs
# run stage (needs the URL's driver, and @electric-sql/pglite for --adopt or an app baseline)
COPY --from=builder /app/migrate.mjs ./migrate.mjs
COPY --from=builder /app/softure-migrations ./softure-migrations
CMD ["node", "migrate.mjs", "--migrations-dir", "./softure-migrations"]
```

A config that imports `server-only` throws under plain Node: run the export as
`npx tsx --conditions=react-server scripts/migrate.ts --export-migrations …` and bundle with
`--alias:server-only=./scripts/empty.mjs` (an empty file). Path aliases (`@/…`) need nothing extra: tsx and
esbuild both read `paths` from `tsconfig.json`. The [ops container recipe](../../modules/ops/README.md#container-recipe)
uses the same commands.

The drivers and drizzle's two driver adapters stay external: bundled, the adapter of a driver the app
does not install imports it at the top of `migrate.mjs`, which then fails at start. At run time they
come from the standalone output, which carries the installed driver and its adapter.

A bundle cannot find package folders (`import.meta.url` points at the bundle), hence
`--export-migrations` at build time and `--migrations-dir` at run time. The build stage needs no
`DATABASE_URL`: the config accepts an empty `database.url` (`DATABASE_URL ?? ""`) and only a command that
connects refuses it. The ledger's own migration
ships as code.

**The app's own migrations** run in the same step, through hooks. `before` runs ahead of the module
files (app tables a module references, normally the app's whole history), `after` behind them (app
migrations that reference a table a module creates). With drizzle, define them once and pass the same
object to the migrate script and to `createTestDatabase`:

```ts
// db/app-migrations.ts
import type { AppMigrations, DatabaseHandle } from "@softure-ai/db";

async function runDrizzle(handle: DatabaseHandle, migrationsFolder: string): Promise<void> {
  if (handle.kind === "postgres") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    await migrate(handle.db, { migrationsFolder });
  } else {
    const { migrate } = await import("drizzle-orm/pglite/migrator");
    await migrate(handle.db, { migrationsFolder });
  }
}

export const appMigrations: AppMigrations = {
  before: (handle) => runDrizzle(handle, "./drizzle"),
  // only when an app migration needs a module table: a second drizzle folder
  // after: (handle) => runDrizzle(handle, "./drizzle-after"),
};

// scripts/migrate.ts
process.exitCode = await runMigrateCli({ config, argv: process.argv.slice(2), app: appMigrations });
```

- Order of a run: the ledger, `before`, the module files in dependency order, `after`. Everything
  runs under the migration lock, after every module file passed its checks; nothing runs when a check
  fails. The hooks run on every run, so they must skip what they already applied (drizzle does).
- A hook that throws is reported as `db.app_migration_failed` with the error and its causes (drizzle
  puts the Postgres message in `cause`). A failing `before` stops the run before any module file; a
  failing `after` leaves the module files applied.
- `--plan` runs no hook (it says so); `--adopt` without `--plan` runs `before` first, so the app
  migration that moves a table into the module's schema and the adoption are one command.

**A baseline: fresh databases after an adoption.** The app keeps its old migrations, so every fresh
database (the unit-test template, an integration stack, a reset dev database) recreates the tables it
moved into a module's schema before the module files run. `baseline` names, per module, the last module
file the app's own history creates; `migrate` then adopts or migrates by itself, on every database:

```ts
export const appMigrations: AppMigrations = {
  before: (handle) => runDrizzle(handle, "./drizzle"),
  // the app's history creates auth's 0001 (users, sessions); 0002.. are new to it
  baseline: { auth: 1 },
};
```

- For a listed module the ledger has never seen, after `before` and after the modules it depends on:
  an empty schema is migrated normally; otherwise the schema is compared with what files 1..n create
  (as `--adopt` does), files 1..n are recorded as `adopted` and the later files are applied. A
  difference stops the run (`db.schema_mismatch`, every difference printed); nothing of that module is
  recorded and `after` does not run.
- Once the module is in the ledger the entry has no effect, so the same command serves every deploy.
  Keep the number when the module ships new files: it describes the app's history, which no longer
  changes.
- Only a prefix 1..n can be adopted (the ledger refuses a file numbered below an applied one): when the
  app's tables already carry a later file's change, align them in the app's own migration or raise n.
- A module that is not enabled, has no schema, or an n outside 1..files refuses the run before anything
  runs. `--plan` marks the files a baseline may adopt (`adopted if its schema already holds objects`).
- The comparison builds the reference on a scratch PGlite, only when a module is actually adopted,
  with stubs of the app tables `before` created (section 5, adoption).
- Under node-postgres a hook queries through the pool while the migrator holds one connection, so the
  pool needs at least two (`createDatabase`'s default is 10).
- The `softure` bin reads only the config; an app with its own migrations uses the script above.
- In a bundle, the drizzle folder must be copied next to the bundle, as the module files are.

**Options of `softure migrate`:**

| Option | Effect |
| --- | --- |
| (none) | apply every pending migration |
| `--plan` | print what would be applied (or adopted); change nothing |
| `--adopt <module>@<version>` | record an existing schema as migrated after comparing it, after applying the pending migrations of its dependencies (section 5) |
| `--through <n>` | with `--adopt`: adopt files 1..n only; the next migrate applies the rest |
| `--migrations-dir <dir>` | read module files from `<dir>/<module id>/` |
| `--export-migrations <dir>` | copy module files to `<dir>/<module id>/` and exit; needs no database; replaces older `.sql` copies and refuses a module folder holding anything else |

Exit codes: 0 done, 1 a problem or failure (each printed on stderr), 2 a usage error.

The same operations as functions: `migrate(handle, { modules, migrationsDir?, app?, onApplied?, onAdopted?, onAppMigrated? })`
(`runAppMigrations(handle, app, phase)` runs one hook alone under the lock),
`planMigrations(handle, { modules, app? })` (`pending`, and `baseline`: the pending files a baseline may adopt),
`adoptModule(handle, { modules, module, version, through?, dryRun? })`,
`exportMigrations(modules, dir)`. Each returns `{ ok: true, value } | { ok: false, error, problems }`;
`describeProblem(problem)` gives the English line.

For a deploy, `checkExportedMigrations(dir, journal)` runs the same comparison on an exported folder without the app
config: `journal` is `readJournal(session)` of the target database, and the result lists the pending files and the
ledger modules the folder does not hold, or every problem. `softure-deploy schema-guard` (`@softure-ai/deploy`) is
built on it.

## 5. Migrations and tables

**Owned:** schema `softure`, table `softure.migrations` (`id, module, version, name, checksum,
module_version, method ('applied' | 'adopted'), applied_at`, primary key `(module, version)`).

**Module files** (`migrations/NNNN_<lower_snake>.sql`, numbered 1..n without gaps):
- the file opens with a comment block that contains `Rollback:` and says how to undo it;
- no top-level statement may begin, end or abort a transaction (`BEGIN`, `COMMIT`, `ROLLBACK`,
  `END`, `ABORT`, `START TRANSACTION`, `PREPARE TRANSACTION`); bodies in quotes or dollar quotes
  (PL/pgSQL `BEGIN … END;`) are fine, SQL-standard `BEGIN ATOMIC` bodies are not. Each file runs in
  its own transaction with its ledger row, and a file that still ended it is reported as such,
  not as rolled back;
- unqualified names land in the module's schema: the runner runs `CREATE SCHEMA IF NOT EXISTS` and
  `SET LOCAL search_path TO <schema>, public` first. Name other modules' tables with their schema
  (`REFERENCES notes.notes (id)`), and create extensions `WITH SCHEMA public`.

**Each run:** the ledger, the app's `before` hook, modules in dependency order (`sortModulesByDependencies`), files in number order.
Before anything runs, every file of every module is checked: an applied file that was edited or
renamed (`db.migration_changed`), deleted (`db.migration_missing`), or a new file numbered below an
applied one (`db.migration_out_of_order`) refuses the whole run. The run holds a session-level
`pg_advisory_lock`, so a second runner waits, then finds nothing to do. A failing file is rolled
back completely and stops the run; the files before it stay applied. The migration connection is
closed after the run, never returned to the pool. The app's `after` hook runs last (section 4).

**Refused modules:** the id `softure`; the schemas `softure`, `public`, `information_schema`,
`drizzle` (drizzle's ledger in every app), `pg_*` and names over 63 bytes; migrations without a `dbSchema`.

**Adoption** ([docs/05](../../docs/05-adoption-playbook.md) step 3): after the app's own migration
moved its tables into the module's schema, `--adopt <module>@<version>` (with `--plan` first)
builds the schema the module's migrations create on a scratch PGlite and compares it with the live
one through `pg_catalog`: relations (and whether they are unlogged), columns (type, collation,
not null, default, identity, generated), sequences with their parameters, constraints and indexes
(names and definitions), triggers, functions, and enum, domain, range and composite types. Only an
exact match records the files as `adopted`; every difference is printed (`missing in database: …`,
`unexpected in database: …`). `--through <n>` compares with and adopts files 1..n only; the next
migrate applies the rest. The version must equal the enabled module's and the module must be new to
the ledger. The pending migrations of the modules it depends on are applied first (listed as
`apply` lines; a dry run applies nothing); when one fails because its tables exist too, adopt that
module first. Module SQL may reference the app's own tables (`REFERENCES public.app_users (id)`):
the scratch database first gets stubs of every table outside the ledger, the enabled modules'
schemas and `drizzle`, copied from the live database (columns with their types, primary keys,
unique constraints, plain unique indexes and the enum types they use; no defaults, NOT NULL, checks
or foreign keys). The tables must therefore exist when the comparison runs: `--adopt` and a baseline
run `before` first, a `--plan` dry run reads only what is already there. A stub that cannot be
created (a domain or extension type) is skipped, and named in the failure when the module needs it.
For fresh databases of an app that adopted a module, declare a baseline (section 4). Undo:
`DELETE FROM softure.migrations WHERE module = '<id>' AND method = 'adopted'`.

**Tests:** `createTestDatabase(modules)` from `@softure-ai/db/testing` returns `{ db, client, close }`:
an in-memory PGlite with the ledger and the listed modules migrated (list the module and the
modules it depends on). Each module set is migrated once per test worker and copied per call; a
broken migration throws naming the file. An app with its own migrations passes the same hooks,
`createTestDatabase(modules, { app: appMigrations })`, so module tables can reference app tables; the
template is cached per hook object, so import the shared object rather than writing hooks inline.

```ts
import { createTestDatabase } from "@softure-ai/db/testing";

const database = await createTestDatabase([notes()]);
afterEach(() => database.close());
```

## 6. Environment variables

None read by the package. The app passes `DATABASE_URL` (or any variable) through
`database.url` in its config.

## 7. Switches

None.

## 8. Appearance

None.

## 9. Copy

None: no user-facing text. Command output and problem lines are English developer messages.

## 10. Hooks

`onApplied(step)` in `migrate` options, called after each committed file.

## 11. GDPR

No personal data. The ledger holds module ids, file names and checksums.

## 12. Limitations

- Forward only: there are no down migrations; each file states its rollback in its comment.
- A file cannot run outside a transaction (`CREATE INDEX CONCURRENTLY`, `ALTER TYPE … ADD VALUE`
  before Postgres 12).
- No lock timeout: a stuck runner holds the lock until its connection ends (visible in `pg_locks`).
  The session-level lock needs a direct connection or a session-mode pooler, not a
  transaction-mode PgBouncer.
- Adoption does not compare grants, comments, column order, row-level security policies or view
  bodies, and needs PGlite installed where it runs (also in an image that otherwise uses `pg`).
- The app table stubs of the reference carry no domains, extension types, views or functions: a
  module whose SQL needs one of those from the app cannot be adopted (`db.adopt_reference_failed`
  names the skipped stub objects).
- No cached connection for Next.js dev reloads yet; the Next adapter (identity ID-1, FD-7) adds it.
