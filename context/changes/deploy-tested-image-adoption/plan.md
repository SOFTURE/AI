# Plan: deploy-tested-image-adoption

Input: change.md (research and framing skipped, reasons there). Complexity: high (five gaps, four phases).

## Today (master `db146c5`)

- `deploy-app.yml`'s `build` job always checks out the tag and runs `docker/build-push-action` with `push: true`
  (`push: false` and a `docker load` archive on the `e2e` path). Its outputs are `image` (`<image>:<tag>`) and
  `digest`; `summary` puts both into `deploy-report.json`.
- `schema-guard` reads `softure.migrations` through `readJournal` over a `pg.Client` from `DATABASE_URL` and compares
  it with the exported folder (`checkExportedMigrations`). Nothing reads another ledger.
- drizzle-orm's migrator (`node_modules/drizzle-orm/migrator.js`) keeps `drizzle.__drizzle_migrations(id, hash,
  created_at bigint)`; `created_at` is the journal entry's `when` (`meta/_journal.json`), `hash` the sha256 of the
  whole `<tag>.sql` text. It reads only the newest row and applies every entry whose `when` is greater; an older
  image therefore applies nothing and raises no error, and an entry inserted below the newest applied one never runs.
- `deploy.sh.tmpl` (database part) builds `DATABASE_URL=postgresql://postgres:<POSTGRES_PASSWORD>@127.0.0.1:5432/<db>`
  (`connect_database`) and runs `backup`, `schema-guard`, `row-counts` with that URL on the host (npx) or in the
  helper image (`--network host`). The compose template publishes Postgres on `127.0.0.1:5432` for it. `report`
  already uses `compose exec -T postgres psql`. The deploy flow has no extension point; the app would have to fork
  the script.
- `env render` reads values from `process.env` only. `deploy-app.yml`'s render step parses `app-secrets` and
  `app-vars` JSON itself and spawns the CLI with them as its environment.

## Goal

Each of the issue's five gaps closed in `@softure-ai/deploy`, opt-in, with the docs to adopt it.

**Out of scope (the issue keeps them app-side):** row counts failing on any change, the release-notes markers. A
change to the workflow's render step (it keeps parsing the JSON itself, since its default CLI version is the
published one).

## Key decisions

- **Prebuilt image = a digest of the same image name.** New input `prebuilt-image: <image>@sha256:<64 hex>`. The check
  job refuses another name than `image` (a re-tag stays inside one package, which `packages: write` of the caller
  covers) and refuses it with `e2e`. The build job then skips checkout and build and runs
  `docker buildx imagetools create --tag <image>:<tag> <image>@sha256:…` (the registry copies the manifest, no layer
  is pulled), reads the tag back with `imagetools inspect` and fails unless it names that digest. `digest` and `image`
  outputs stay as they are. `build-args` keep their meaning for the `.env.prod` comparison (they must be the ones the
  image was built with); `context`, `dockerfile` and `sparse-checkout` are unused.
- **App ledger guard.** `schema-guard --app-migrations-dir=<drizzle folder> [--app-ledger=drizzle.__drizzle_migrations]`
  compares the ledger rows with `meta/_journal.json` by `created_at` = `when`: a row no entry matches is refused (the
  image is older than the database), an unapplied entry older than the newest row is refused (drizzle would skip it
  for good), the entries after the newest row are pending. A hash that differs from the file is printed as a note,
  never a refusal: drizzle never re-reads applied files, and apps edit comments in them. `--migrations-dir` becomes
  optional when `--app-migrations-dir` is given (one of the two is required).
- **Ledger rows without a connection.** `schema-guard --print-sql` prints a psql script (`\gset`/`\if`, so an absent
  ledger table reads as no rows) whose output is one JSON line `{"softure":[…],"app":[…]}`; `--ledger-file=<path>`
  (`-` = stdin) reads that line instead of connecting. The same pair for row counts: `row-counts --print-sql` prints
  one statement (`query_to_xml` counts a table only when `to_regclass` finds it) whose output is
  `{"<table>": <count|null>}`, and `--counts-file=<path|->` reads it; the file must hold exactly the listed tables
  (review 1). The SQL comes from the CLI, so the table list
  and its quoting stay in one place.
- **Backup from a dump file.** `backup --from-file=<dump>` takes a dump written elsewhere (`compose exec … pg_dump`):
  the PGDMP header check, the stamped name, mode 0600 and retention as before; deploy.sh writes the dump as a hidden file
  inside `backups/`, so the move is a rename (copy and remove only across file systems, review 2). Refused together with `--pg-dump` or `--exclude-table-data` (pg_dump's options).
- **compose exec mode in deploy.sh:** a variable `DATABASE_ACCESS=port` at the top (the app sets `exec`). With
  `exec`, `db_exec` runs `pg_dump`/`psql` in the postgres service as `${POSTGRES_USER:-postgres}` on
  `${POSTGRES_DB:-$POSTGRES_USER}` read inside the container (the official image's own variables and defaults, over the
  local socket), so neither a published port nor a password in `.env.prod` is needed. Backup, schema guard and row
  counts then run `print-sql | psql | --ledger-file/--counts-file` through files in the run's temporary folder.
  `port` stays the default and behaves as today.
- **App ledger in deploy.sh:** `APP_MIGRATIONS_DIR=""` (a folder in the image, e.g. `/app/drizzle`) and
  `APP_LEDGER=drizzle.__drizzle_migrations`; when the folder is set, the schema step copies it out of the new image
  next to the softure export and passes `--app-migrations-dir`.
- **Hook points are files, not deploy.json keys (deviation from the issue's wording).** The release's compose folder
  may hold `hooks/pre-migrate.sh`, `hooks/post-up.sh`, `hooks/maintain.sh`; a present file runs with `bash` from the
  app folder at its point, as step `hook-<point>`. The release ships them (installed like every compose-folder file),
  so they are reviewed and versioned with the tag; reading them needs no JSON parser, which a host without Node and an
  app without a database lack. Points: `pre-migrate` after the database checks and before the switch (a failure
  restores the files like any step there), `post-up` after the switch and the Traefik recreate (before the counts
  after), `maintain` at the end of `maintain`. A hook gets `TAG`, `PREVIOUS_TAG`, `APP_DIR`, `COMPOSE_FILE`,
  `COMPOSE_ENV_FILES` (so `docker compose exec …` reaches the live stack) and `HOOK_POINT` (`COMPOSE_ENV_FILES` needs Compose 2.24+, documented, review 3); its stdout goes to stderr,
  so only deploy.sh writes `step|`/`result|` lines.
- **env render from JSON:** `--secrets-json=<VAR>` and `--vars-json=<VAR>` name variables holding JSON objects.
  With either flag the values come only from those objects (vars over secrets, the names taken over a secret listed),
  never from the rest of the environment, so a runner variable cannot slip into `.env.prod` under an optional name.
  Non-string values are skipped, as in the workflow. Invalid JSON is refused by the variable's name, never its value.

## Phases

### Phase 1: CLI (TDD)

- `src/db/app-ledger.ts`: read the drizzle journal, compare with ledger rows (pure), read rows over a client.
- `src/db/ledger-sql.ts`: the psql script for the ledgers, the statement for row counts, parsers of their output.
- `src/db/schema-guard.ts`, `src/db/backup.ts` (`importBackup`), `src/cli/db-commands.ts`,
  `src/cli/env-command.ts`, `src/cli/run.ts` USAGE.
- Tests: `src/db/app-ledger.test.ts`, `src/db/ledger-sql.test.ts` (output parsers, refusals), `tests/db-cli.test.ts`
  (real Postgres when `SOFTURE_TEST_POSTGRES_URL` is set: the app ledger over a connection; `--print-sql` through the
  real `psql` into `--ledger-file`/`--counts-file`; `--from-file`), `tests/cli.test.ts` (env render from JSON).
- Done when: deploy tests green.

### Phase 2: deploy.sh (TDD)

- `templates/docker/server/deploy.sh.tmpl`: `DATABASE_ACCESS`, `db_exec`, exec paths of backup/schema/row counts,
  `APP_MIGRATIONS_DIR`/`APP_LEDGER`, hooks at three points; header comments.
- `e2e/app/` regenerated (`npm run e2e-app -w @softure-ai/deploy`).
- Tests in `tests/server-files.test.ts`: hooks run at their points with the env and stdout on stderr, a failing
  pre-migrate hook restores the files, a failing post-up hook fails after the switch, the maintain hook; exec mode
  sends pg_dump/psql through `compose exec -T postgres` and the CLI gets `--from-file`/`--ledger-file`/`--counts-file`;
  the app migrations folder is copied and passed.
- Done when: deploy tests green.

### Phase 3: workflow (TDD)

- `.github/workflows/deploy-app.yml`: `prebuilt-image` input, check-job validation, re-tag steps in `build`.
- Tests: `tests/release-guards.test.ts` (validation in bash), `tests/repo/deploy-workflows.test.ts` (build steps
  gated on the input, the re-tag reads the digest back).
- Done when: repo and deploy tests green.

### Phase 4: docs and gates

- README: "Deploy workflow" (input, how), "`env render`" (JSON flags), "Database steps" (`--from-file`,
  `--app-migrations-dir`, `--print-sql`/`--ledger-file`/`--counts-file`), "`init`" (`DATABASE_ACCESS`, app ledger,
  hooks), "Parity" (what moved into the package), USAGE; CHANGELOG `## Unreleased`; `package.json` description.
- Done when: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` green.

## Progress

- [x] Phase 1: CLI
- [ ] Phase 2: deploy.sh
- [ ] Phase 3: workflow
- [ ] Phase 4: docs and gates
