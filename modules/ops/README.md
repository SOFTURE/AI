# @softure-ai/ops

**Depends on:** core, db.

## 1. What it provides

The operational basics of a SOFTURE app: `GET /api/health` that checks the database and every
enabled module, a container recipe that runs `softure migrate` once before the app starts under
least-privilege database roles, and a helper for safe ops scripts (dry run by default, `--commit`
writes, one transaction, a guard test).

## 2. Installation

```bash
npm install @softure-ai/ops
```

Peer dependency: `drizzle-orm`. It needs no Next.js import of its own, so the app's Next and React
are the only ones in play.

## 3. Configuration

```ts
// softure.config.ts
import { ops } from "@softure-ai/ops";

modules: [
  // ...the app's other modules,
  ops(),
  // or with the app's own checks and a longer limit:
  ops({ checks: { "app.queue": checkQueue }, timeoutMs: 5_000 }),
],
```

| Option | Type | Default | Meaning |
| --- | --- | --- | --- |
| `checks` | `Record<string, HealthCheck>` | `{}` | The app's own checks, run after the database and module checks. Names: lowercase letters, digits, `_ . -`; not `database` and not the id of a module with a check. |
| `timeoutMs` | integer 100…30000 | `3000` | How long one check may run before it counts as `timed_out`. |
| `detail` | `"status"` \| `"checks"` | `"status"` | `status`: the answer is `{ status }` only, so a stranger learns nothing. `checks`: it also lists every check by name and state. |
| `getDatabase` | `() => Promise<Queryable>` | none | The app's own database instead of the route's own pool. **Required for `pglite://`**: a PGlite folder must not be opened twice in one process (the route refuses with a 500 that names this option). |

**Module checks.** Any module contributes a check through the module contract, and it runs whenever
the module is listed in the config:

```ts
export const notes = defineModule({
  manifest: { /* ... */ },
  // ...
  health: async ({ db }) => {
    await (db as Queryable).execute(sql`select 1 from notes.notes limit 1`);
    return ok();
  },
});
```

A `HealthCheck` is `(context: ModuleContext) => Promise<Result<undefined>>`. `ok()` is healthy; an
`Err`, a throw or running past `timeoutMs` is not. Keep it to one cheap query: it runs on every probe.

## 4. Mounting

```ts
// app/api/health/route.ts
export { GET } from "@softure-ai/ops/next";
```

| Situation | Code | Body (`detail: "status"`) | Body (`detail: "checks"`) |
| --- | --- | --- | --- |
| every check passes | 200 | `{ "status": "ok" }` | `{ "status": "ok", "checks": { "database": "ok", "notes": "ok" } }` |
| any check fails or times out | 503 | `{ "status": "unavailable" }` | `{ "status": "unavailable", "checks": { "database": "failed", "notes": "timed_out" } }` |
| `ops()` not in the config | 500 | (Next's error page; the log names the fix) | |

- Checks run in this order and all at once: `database` (`select 1`, when the config has a database),
  each enabled module's check under the module id, then the app's `checks`.
- The answer carries `cache-control: no-store`, and `next build` lists the route as dynamic (ƒ):
  a cached "ok" is exactly the false green this endpoint exists to prevent.
- Causes go to the server log only: `health check "notes" failed: core.database_failed`, or the
  error class and SQLSTATE (`errorLogLabel`), never an error message, a query or a URL.
- The route is public and has no input. Concurrent requests share one run of the checks (single
  flight), so a flood of probes costs one query per check at a time. It is not rate-limited through
  `@softure-ai/security` on purpose: that would make health depend on the database it reports on.
- Without `getDatabase`, the route keeps its own pool of two connections per database URL (package
  code cannot reach the app's pool). `closeHealthDatabases()` from `@softure-ai/ops/next` closes it
  on shutdown.
- Programmatic use (no Next): `collectHealthChecks(config, db)` and
  `runHealthChecks(context, { checks, timeoutMs })` from `@softure-ai/ops/server`.

## 5. Migrations and tables

None. The module has no schema. Its container recipe runs the migrations of every other module
(section "Container recipe" below).

## 6. Environment variables

The module reads none. The container recipe uses these on the containers:

| Variable | Where | Meaning |
| --- | --- | --- |
| `DATABASE_URL` | app, migrate | the app connects as the app role; the migrate step as the migrator role |
| `SOFTURE_MIGRATOR_PASSWORD`, `SOFTURE_APP_PASSWORD` | postgres (first start) | required by `recipes/initdb/01-roles.sql` |
| `SOFTURE_MIGRATOR_ROLE`, `SOFTURE_APP_ROLE` | postgres (first start) | role names; default `softure_migrator`, `softure_app` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | build | same value for every build when instances come from different builds (docs/02 §8) |

## 7. Switches

None.

## 8. Appearance

No components. The dictionaries name the check states for an admin view.

## 9. Copy

`health.ok`, `health.failed`, `health.timed_out`, `health.unavailable` in `src/messages/en.ts` and
`src/messages/pl.ts`. The endpoint itself answers codes, not copy.

## 10. Hooks

- `health` on any module's `defineModule` (section 3).
- `checks` in `ops({ checks })` for the app's own.

## 11. GDPR

Stores and exports nothing. The health answer carries no personal data; ops scripts print what
their `before` and `after` return, so a script that touches personal data returns ids, not emails
(FIRE_TRACKER FR-034).

## 12. Limitations

- A check past `timeoutMs` is reported as `timed_out`, but its query keeps running until the
  database answers; the pool of two connections and single flight keep that from piling up.
- One endpoint for liveness and readiness. Orchestrators that restart on a failed liveness probe
  restart the app while the database is down; point liveness at a page instead if that matters.
- `.env.prod` rendering and release notes stay in the app: in FIRE_TRACKER they encode that app's
  secret names, host and changelog, and no other app shares them (research of ID-7).
- `recipes/existing-database.sql` takes over every non-system schema except `public`; a database
  shared with something other than the SOFTURE app needs a narrower list.

## Container recipe

One image, two roles: `node server.js` serves the app; `node migrate.mjs` applies the migrations of
every enabled module once, before the app starts, so the schema cannot drift from the code on it.
The verified instance is the example app: [`Dockerfile`](../../examples/next-app/Dockerfile),
[`compose.container.yaml`](../../examples/next-app/compose.container.yaml) and
[`scripts/container.mjs`](../../examples/next-app/scripts/container.mjs) (`npm run e2e:container`,
CI job `container` in `.github/workflows/e2e.yml`).

**1. The migrate script** the app owns ([db README §4](../../foundation/db/README.md)):

```ts
// scripts/migrate.ts
import { runMigrateCli } from "@softure-ai/db/cli";
import config from "../softure.config";

process.exitCode = await runMigrateCli({ config, argv: process.argv.slice(2) });
```

**2. The image** (`next.config.ts` has `output: "standalone"`):

```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN CI=true npm ci --no-audit --no-fund
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build
# A bundle cannot find package folders: copy each module's SQL out first, then bundle the runner.
RUN npx softure migrate --export-migrations ./softure-migrations \
 && npx esbuild scripts/migrate.ts --bundle --platform=node --format=esm --target=node22 \
      --external:pg --external:@electric-sql/pglite --outfile=migrate.mjs

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 --ingroup nodejs nextjs
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/migrate.mjs ./migrate.mjs
COPY --from=builder /app/softure-migrations ./softure-migrations
USER nextjs
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('node:http').get('http://127.0.0.1:3000/api/health',r=>process.exit(r.statusCode===200?0:1)).on('error',()=>process.exit(1))"
CMD ["node", "server.js"]
```

`pg` reaches the runner through the standalone output (the app lists it in `serverExternalPackages`),
which is why the bundle keeps it external. `HEALTHCHECK` lives in the image, not only in compose, so
it travels to every place the image runs; `node -e` because alpine has no curl.

**3. The roles.** Mount [`recipes/initdb/`](recipes/initdb/01-roles.sql) into the postgres container's
`/docker-entrypoint-initdb.d`. On the first start it creates:

| Role | Privileges | Used by |
| --- | --- | --- |
| `softure_migrator` | `CONNECT, CREATE` on the database, `USAGE, CREATE` on `public`; owns every schema it migrates | the migrate step |
| `softure_app` | `CONNECT`; `USAGE` on the migrator's schemas; `SELECT, INSERT, UPDATE, DELETE` on their tables; `USAGE, SELECT` on their sequences (default privileges) | the app |

The image's `POSTGRES_USER` is a superuser, so an app connecting as it turns a leaked URL into
control of the server. With these roles, a leaked app URL can read and change rows, but cannot
create, alter, drop or truncate anything (checked by the container run). Postgres lets every role
connect to a new database by default; revoke `CONNECT` from `PUBLIC` on other databases of the
cluster when it hosts more than this app.

An **existing database** (migrated earlier as the superuser) runs both files by hand, as the
superuser, then switches the URLs:

```bash
psql -v ON_ERROR_STOP=1 -U postgres -d app -f recipes/initdb/01-roles.sql
psql -v ON_ERROR_STOP=1 -U postgres -d app -f recipes/existing-database.sql
```

**4. Compose.** The migrate step is a one-off service from the same image; the app waits for it:

```yaml
services:
  migrate:
    image: ghcr.io/acme/app:${TAG}
    command: ["node", "migrate.mjs", "--migrations-dir", "./softure-migrations"]
    environment:
      DATABASE_URL: postgresql://softure_migrator:${MIGRATOR_DB_PASSWORD}@postgres:5432/app
    depends_on:
      postgres: { condition: service_healthy }
    restart: "no"
  app:
    image: ghcr.io/acme/app:${TAG}
    environment:
      DATABASE_URL: postgresql://softure_app:${APP_DB_PASSWORD}@postgres:5432/app
    depends_on:
      migrate: { condition: service_completed_successfully }
```

A failed migration stops the deploy before the new code serves a request; the old container keeps
running. `node migrate.mjs --plan` shows what a deploy would apply.

## Safe ops scripts

One-off changes to a live database (grant access, fix a record) follow one pattern (FIRE_TRACKER
`scripts/*.sh` + `*.sql`, `migrate-account.mts`):

- **dry run by default**: the script runs in a transaction that is rolled back and prints what it
  would change; only `--commit` writes;
- **one transaction**: everything commits or nothing does, also when the script throws;
- **measured**: the script returns the state `before` and `after` its change, read inside the open
  transaction; a report without both is refused;
- **strict input**: `--key=value` arguments through a zod schema; unknown or repeated arguments are
  usage errors (exit 2), never ignored;
- **a guard test** runs the real script on a test database, with and without commit.

```ts
// scripts/rename-note-script.ts
import { ok } from "@softure-ai/core";
import { defineOpsScript, refuseOpsScript } from "@softure-ai/ops/scripts";
import { sql } from "drizzle-orm";
import { z } from "zod";

export const renameNote = defineOpsScript({
  name: "rename-note",
  description: "Renames one note.",
  usage: ["--id=<number>   the note", "--title=<text>  its new title"],
  args: z.strictObject({ id: z.coerce.number().int().positive(), title: z.string().min(1).max(100) }),
  run: async (tx, args) => {
    const before = (await tx.execute(sql`select id, title from notes.notes where id = ${args.id}`)).rows;
    if (before.length !== 1) return refuseOpsScript(`expected 1 note, found ${String(before.length)}`);
    await tx.execute(sql`update notes.notes set title = ${args.title} where id = ${args.id}`);
    const after = (await tx.execute(sql`select id, title from notes.notes where id = ${args.id}`)).rows;
    return ok({ before: before[0], after: after[0] });
  },
});

// scripts/rename-note.ts (bundled with esbuild like migrate.ts, run in the app container)
import { runOpsScript } from "@softure-ai/ops/scripts";
import config from "../softure.config";
import { renameNote } from "./rename-note-script";

process.exitCode = await runOpsScript({ script: renameNote, argv: process.argv.slice(2), config });
```

```bash
docker compose exec app node rename-note.mjs --id=7 --title=Fixed            # dry run
docker compose exec app node rename-note.mjs --id=7 --title=Fixed --commit   # writes
```

Output: the mode, `before: {...}`, `after: {...}`, then `COMMITTED` or
`DRY RUN: rolled back, nothing was written. Add --commit to write.` Exit codes: 0 done, 1 refused or
failed (nothing written; a database error is printed as its class and SQLSTATE, never its query),
2 usage error. The script connects with the config's `DATABASE_URL`, so inside the app container it
has the app role's privileges: rows, not schema.

**The guard test** (vitest, PGlite with the module's migrations):

```ts
const db = await createTestDatabase([notes()]);
// ...insert the rows the case needs
const dry = await executeOpsScript(db.db, renameNote, { id: 7, title: "Fixed" }, { commit: false });
expect(dry).toMatchObject({ ok: true, value: { committed: false } }); // and the row is unchanged
const refused = await executeOpsScript(db.db, renameNote, { id: 99, title: "x" }, { commit: true });
expect(refused).toMatchObject({ ok: false, error: "ops.script_refused" }); // and nothing changed
```

`executeOpsScript(db, script, args, { commit })` returns `{ ok: true, value: { committed, report } }`
or the script's refusal, and lets thrown errors through after the rollback.
