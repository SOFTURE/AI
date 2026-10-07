# Plan: adoption-gaps-ops-switches-deploy-core

Input: change.md (research and framing skipped, reasons there). Complexity: medium (four phases, eight packages, no
migration).

## Goal

Every point of issue #158 lands with a test or a measured check, docs match the code, every package has a
CHANGELOG, and the versions on master are ready for one release of everything not yet on npm.

**Out of scope:** the adopting app's own migration; db code (issue #179 changes it in parallel); auth's own fallback
reading of its switch (point 6 names feature-switches); a CLI-side bundle of the schema guard (the functions are
already exported, see D7).

## Findings (the reading behind the plan)

- `01-roles.sql`: `CREATE ROLE` twice, password check for both roles first; `ALTER DEFAULT PRIVILEGES FOR ROLE
  migrator GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES` with no schema, so the ledger `softure.migrations`, which
  the migrator creates (db `ledger.ts`), is writable by the app role. The example app's home page reads the ledger
  as the app role, so `SELECT` must stay.
- `existing-database.sql`: hands every schema but `public` to the migrator (the `drizzle` ledger schema of an app
  included) and grants DML on every table of every schema, ledgers included, to the app role.
- `ops-script.ts`: `parseOpsArguments` takes `--key=value` only; `runOpsScript` has no stdin or file path.
- `route.ts` exports `GET` only; `next/index.ts` re-exports it.
- ops README §Container recipe: `npx softure migrate --export-migrations`; db README: `npx tsx scripts/migrate.ts
  --export-migrations`; compose example `MIGRATOR_DB_PASSWORD` / `APP_DB_PASSWORD` vs `SOFTURE_*_PASSWORD` in §6.
- `env-override.ts` / `switches.ts`: a set override always wins, in both directions.
- `deploy.sh.tmpl`: `deploy_cli` is `npx --yes @softure-ai/deploy@<v>`; two `node -e` calls (row-count table list,
  step-line summary); backup needs `pg_dump` on the host. `guardSchema`, `createBackup`, `countRows` are already
  exported from the package root.
- `safe-error.ts`: `safeError` returns `core.database_failed` or `core.unexpected`; 13 callers read `.error` only.
- `i18n.ts:62`: `new Intl.PluralRules(locale)` per call.
- Manifests vs package deps (module packages only): auth lacks `ops` and `mailing`, billing lacks `ops` and
  `mailing`, waitlist lacks `auth`. auth and billing use ops only for their scripts and mailing only from an optional
  entry, so those are optional (`?`); waitlist reads `auth.users`, and its required `privacy` already requires auth.
- `#154` changed ops and analytics code without a version bump; testing changed (tests) since 0.1.1.

## Key decisions

- **D1 (point 1)** `01-roles.sql` keeps an existing role: it creates a role only when it does not exist, and asks
  for a password only for a role it creates; an existing role keeps its password and attributes. So an app can name
  its own migration role in `SOFTURE_MIGRATOR_ROLE`, and the file can be re-run. `existing-database.sql` gets
  `SOFTURE_APP_SCHEMAS` (default `public,drizzle`): schemas it leaves to the app (no owner change; the app role still
  gets row privileges). README documents the three paths: reuse the app's migration role; keep two migrators
  (default); one migrator for everything (`REASSIGN OWNED BY <app owner> TO softure_migrator`, `public` included).
- **D2 (point 2)** ledgers are read-only for the app role: `01-roles.sql` installs an event trigger
  (`ddl_command_end`, CREATE TABLE) that revokes `INSERT, UPDATE, DELETE, TRUNCATE` from the app role on a table
  created in a ledger schema (`SOFTURE_LEDGER_SCHEMAS`, default `softure,drizzle`). The trigger function runs as
  the role that ran the DDL (the table's owner, who granted the default privileges), so no SECURITY DEFINER; a
  revoke of a privilege the app role does not hold is a warning, not an error. Event triggers need a superuser,
  which both files already require; `existing-database.sql` revokes
  the same on existing ledger tables and installs the trigger too (re-running `01-roles.sql` does). SELECT stays.
  The container run asserts: app role `INSERT INTO softure.migrations` fails with permission denied, `SELECT` works.
- **D3 (point 3)** `OpsScript.secrets?: readonly string[]`: for each named key, `--<key>-file=<path>` reads the value
  from a file and `--<key>-file=-` from stdin (one trailing newline stripped); giving the key and its file form, or
  stdin twice, is a usage error. `runOpsScript` gains `readInput` (file and stdin readers) for tests. Undeclared
  `--x-file` keys stay ordinary arguments.
- **D4 (point 4)** `export const dynamic = "force-dynamic"` in `route.ts`, re-exported from `@softure-ai/ops/next`;
  README mounts `export { GET, dynamic }`. Test: the export exists and equals "force-dynamic".
- **D5 (point 5)** both READMEs use `npx tsx scripts/migrate.ts --export-migrations` (the app's script, which loads
  any config tsx can), with notes for a config importing `server-only` (`tsx --conditions=react-server`, esbuild
  `--alias:server-only=./scripts/empty.mjs`) and path aliases (tsx and esbuild read tsconfig `paths`); the compose
  example uses `SOFTURE_MIGRATOR_PASSWORD` / `SOFTURE_APP_PASSWORD`.
- **D6 (point 6)** switch definition `override: "both" | "towards-fail-mode"` (default `both`). With
  `towards-fail-mode` an override that matches the fail-mode value applies; the other value is ignored (the switch
  reads on as if unset) and logged once by variable name. README and the `auth.registration_closed` example.
- **D7 (point 7)** `deploy.sh.tmpl` runs Node through one helper: the host's `node`/`npx` when present; otherwise a
  local helper image `softure-deploy-tools:<cli>-pg<major>` built once from `node:22-alpine` with
  `postgresql<major>-client` and the CLI installed, run with `--network host`, the caller's uid and the app folder
  mounted. Hosts with Node behave exactly as today. README and the script header say "Node.js 22 and pg_dump, or
  Docker builds them into a helper image". The exported functions cover the bundle route; README names them.
- **D8 (point 8)** README `/app/softure-migrations`; 0.1.3 goes out with the release after the merge.
- **D9 (point 9)** core `PublicError` (an Error whose message is written for the user, branded with
  `Symbol.for("softure.public-error")` so it survives two copies of core) and `getPublicMessage(error): string | null`.
  `safeError` keeps its type (callers switch on two codes); README shows the pass-through pattern.
- **D10 (point 10)** a per-locale `Map` of `Intl.PluralRules`; test counts constructor calls.
- **D11 (point 11)** a repository test: every `@softure-ai/<module>` in a module's `dependencies` or
  `peerDependencies` appears in its `dependsOn` (required or `?`). Manifests: auth `ops ?`, `mailing ?`; billing
  `ops ?`, `mailing ?`; waitlist `auth`.
- **D12 (point 12)** `CHANGELOG.md` in every workspace package and the template, listed in `files`; the package test
  requires both. Format: newest version first, `## <version>` with bullets; the current unreleased version names
  this change's items; earlier history points at GitHub Releases. docs/05 "Definition of done" names the note
  format `verified in: <app>@<sha>` neutrally.
- **D13 (point 13)** testing README: the install line without release history, `setupFiles` takes the bare
  specifier (the setup file comment says so); core and db are already fixed on master.
- **Versions:** ops 0.1.5 → 0.1.6, analytics 0.1.5 → 0.1.6, testing 0.1.1 → 0.1.2; the rest keep their unreleased
  bump (auth 0.1.7, billing, waitlist, feature-switches, core, db 0.1.6, deploy 0.1.3).

## Phase 1: ops and the recipes (points 1–5)

- Tests: ops-script secret files and stdin (value read, newline stripped, key plus file refused, stdin twice
  refused, undeclared `-file` key passed through); route exports `dynamic`. Recipes: run on local Postgres 16
  (fresh: roles, trigger, app role INSERT into a ledger refused, SELECT allowed; existing: reuse a role, app schemas
  untouched); container.mjs assertion.
- Code: `recipes/initdb/01-roles.sql`, `recipes/existing-database.sql`, `src/scripts/ops-script.ts`,
  `src/next/route.ts`, `src/next/index.ts`, ops README, db README, `examples/next-app/scripts/container.mjs`, and
  deploy's copy `templates/docker/prod/initdb/01-roles.sql.tmpl` (a test pins it to the ops recipe) with the
  committed e2e app regenerated.

Done when: new tests seen red, then green; recipe runs recorded in the impl review; gates green.

## Phase 2: feature-switches, core, manifests (points 6, 9, 10, 11)

- Tests: towards-fail-mode for both fail modes (matching value applies, other ignored and logged once, default
  `both` unchanged); `PublicError` and `getPublicMessage` (own error, foreign object with the brand, plain Error,
  non-errors); `selectPlural` builds one rule set per locale; manifests test fails on today's manifests.
- Code: `feature-switches/src/options.ts`, `server/switches.ts`, `server/env-override.ts`, README;
  `core/src/safe-error.ts`, `i18n.ts`, `index.ts`, README; auth, billing, waitlist manifests (`module.json` and
  `src/index.ts`); `tests/repo/packages.test.ts`.

Done when: tests seen red, then green; gates green.

## Phase 3: deploy (points 7, 8)

- Tests: `server-files.test.ts` runs deploy.sh with a PATH without node and npx: the helper image is built once and
  the CLI and `node -e` run through `docker run`; with node on PATH nothing changes (existing tests).
- Code: `templates/docker/server/deploy.sh.tmpl`, README; regenerate the committed e2e app's `deploy.sh` if it is
  generated from the template (`npm run e2e-app -w @softure-ai/deploy`).

Done when: tests seen red, then green; gates green.

## Phase 4: CHANGELOGs, docs, versions (points 12, 13)

- Tests: the package test requires `CHANGELOG.md` and its `files` entry.
- Code: a CHANGELOG per package and the template, `files` entries, docs/05, testing README, version bumps (ops,
  analytics, testing) with lockfile.

Done when: gates green (typecheck, lint, test, build).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: ops and the recipes

#### Automated
- [ ] 1.1 Ops script and route tests seen red, then green
- [ ] 1.2 Recipes run on Postgres 16 (fresh and existing database)
- [ ] 1.3 Gates green (typecheck, lint, test)

### Phase 2: feature-switches, core, manifests

#### Automated
- [ ] 2.1 Switch, core and manifest tests seen red, then green
- [ ] 2.2 Gates green (typecheck, lint, test)

### Phase 3: deploy

#### Automated
- [ ] 3.1 deploy.sh without host Node tested red, then green
- [ ] 3.2 Gates green (typecheck, lint, test)

### Phase 4: CHANGELOGs, docs, versions

#### Automated
- [ ] 4.1 CHANGELOG test seen red, then green
- [ ] 4.2 Gates green (typecheck, lint, test, build)
