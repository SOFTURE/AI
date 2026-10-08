# Research: deploy-adoption-prebuilt-image

Read on master `c323892`. Sources: `tools/deploy` (CLI, templates, tests), `.github/workflows/deploy-app.yml`, and the
adopting app's `docker/server/deploy.sh`, `gateway.sh`, `scripts/schema-guard.ts` and release workflow (read only).

## Today

- **Workflow.** `deploy-app.yml` has jobs `check → build → deploy → verify → summary`. `build` always checks out the
  tag and runs `docker/build-push-action` (`push` unless `e2e`); its outputs `image` (`<image>:<tag>`) and `digest`
  feed the deploy job (pull by tag on the server) and the report. Nothing takes an existing image.
- **Adopting app's release.** It builds `sha-<sha>` once, runs its integration suite on that image, then re-tags it
  for the release; deploying through `deploy-app.yml` would rebuild from the tag (a different image).
- **schema-guard.** `runSchemaGuard` connects with `DATABASE_URL` and calls `guardSchema(client, dir)`:
  `readJournal` (`softure.migrations`, empty without the table) against `checkExportedMigrations` of the image's
  exported folder. The app ledger (`drizzle.__drizzle_migrations`) is never read. The app's own guard counts
  `meta/_journal.json` entries in the image against the rows of that table and refuses fewer; for the module ledger
  it pipes the rows as JSON from `psql` into a script in the image (no DB connection from the guard).
- **deploy.sh template.** One fixed sequence: archive, files, pull, postgres, backup, schema, row-counts-before,
  switch, traefik, row-counts-after, tag, cron. `maintain` is daily: backup and images. No extension points. The app
  runs between them: env re-checks, `compose run --rm db-migrate` and a one-time import before `up`, a dry run of a cron
  job after `up`, a 15-minute cron line purging `security.rate_limits`, and a content publish after `up`.
- **Database access.** `connect_database` builds `postgresql://postgres:$POSTGRES_PASSWORD@127.0.0.1:5432/<name>`;
  every DB step runs the CLI (host `npx` or the helper image on the host network). The app's compose publishes no
  Postgres port and sets `POSTGRES_USER`/`POSTGRES_DB`; it runs `compose exec -T postgres pg_dump|psql`.
- **env render.** `runEnvRender` reads `io.env` only. The workflow's render step builds that environment from
  `app-secrets` and `app-vars` JSON (vars win, `PATH|HOME|NODE_*|NPM_CONFIG_*` refused) before calling the CLI.
- **Tests.** `tests/server-files.test.ts` runs the workflow's pack step and the generated `deploy.sh` with stub
  `docker`, `npx`, `crontab`, `flock`; `tests/release-guards.test.ts` runs the check and render steps;
  `tests/db-cli.test.ts` runs the DB commands on Postgres when `SOFTURE_TEST_POSTGRES_URL` is set.
  `tests/e2e-scripts.test.ts` fails when the committed `e2e/app/` differs from `init`.

## Findings that shape the plan

- `query_to_xml` is volatile, so `CASE WHEN to_regclass(…) IS NULL THEN … ELSE query_to_xml('…') END` runs the inner
  query only for a table that exists: one statement can read an optional table (checked on Postgres 16). A JSON value
  survives the XML text node when base64-encoded inside it (`encode(convert_to(…), 'base64')`).
- `pg_dump` inside the official Postgres image connects over the local socket as `POSTGRES_USER` without a password.
- `docker buildx imagetools create --tag <new> <source@digest>` with one source copies the manifest unchanged, so the
  re-tagged image keeps the digest (checked again by `imagetools inspect`).
- The CHANGELOG has an `Unreleased` flow (`release:version` promotes it); the version stays 0.1.4 here.
