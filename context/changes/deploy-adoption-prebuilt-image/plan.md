# Plan: deploy-adoption-prebuilt-image

Input: change.md, research.md (framing skipped, reason in change.md). Complexity: high (four phases).

## Goal

All five points of #246 in `@softure-ai/deploy` (unreleased; #247/#248 follow and the last one releases), 0.1.4
behaviour the default everywhere.

**Out of scope:** row counts failing on any change and the app's release-notes markers (the issue keeps them
app-side); refusing modules the image does not ship (`absent` stays "left as they are", the package's documented rule).

## Key decisions

- **Snapshot SQL, one path (2, 4).** `buildLedgerQuery({ appLedger })` returns one statement printing one JSON line
  `{"softure":[rows…],"app":<rows>|null}`; `buildRowCountQuery(tables)` one printing `{"<table>":<count>|null,…}`.
  Optional tables are read through `CASE WHEN to_regclass(…) IS NULL THEN … ELSE query_to_xml('…') END` (the inner query
  runs only when the table exists); the ledger's JSON rides base64 inside the XML text node. Table names are checked
  against `TABLE_NAME_PATTERN` and quoted. The connection mode runs the same statements through `pg`, so the stdin
  mode and the connection mode cannot disagree, and the Postgres tests cover the SQL.
- **CLI flags.** `schema-guard [--app-journal=<file> [--app-ledger=drizzle.__drizzle_migrations]] [--stdin]
  [--print-query]`; `row-counts [--stdin] [--print-query]`; `backup --stdin` (a custom-format dump on stdin; with it
  `--url-env`, `--pg-dump` and `--exclude-table-data` are usage errors: the dump is made elsewhere). `--print-query`
  needs no database and writes nothing else. The app guard: the journal's `entries` count must be at least the ledger's
  rows; a ledger table that does not exist counts 0; `--app-ledger` without `--app-journal` is a usage error.
  `guardSchema(client, dir)` stays exported and keeps its result shape.
- **env render (5).** `--from-json-env=<NAME>` (repeatable): the values come only from those variables' JSON objects,
  later ones winning; a variable that is unset or not a JSON object fails naming the variable, never a value;
  non-string values are ignored. Without the flag nothing changes.
- **deploy.json (3, 4).** `database.access: "host" | "compose-exec"` (default host), `database.appMigrations: { journal:
  <absolute path in the image>, ledger?: schema.table }`, `database.excludeTableData: [table…]` (the dump keeps their
  definition, not their rows), and `hooks: { "pre-migrate"?, "post-up"?, "maintain"? }`. A hook is
  `{ name, compose: [args…] }` (run as `docker compose --env-file .env.prod --file docker-compose.yml <args>`) or
  `{ name, run: [argv…] }` (a host command in the app folder, e.g. `bash hooks/x.sh` for a script the release ships in `docker/prod/`;
  installed files are 0644, plan review F3); a
  `maintain` hook may carry `schedule` (five cron fields) and then gets its own crontab line running
  `deploy.sh maintain <name>` instead of the daily run. Names: lower-case words, unique, never a built-in step name.
- **server-settings.** New command `softure-deploy server-settings --config=<deploy.json> --out-dir=<dir>` validates
  the file and writes small files `deploy.sh` reads without parsing JSON: `access`, `app-journal`, `app-ledger`,
  `exclude-table-data` (comma list), `hooks-<point>` and `cron` as NUL-separated records. Validation (cron fields,
  names) therefore happens in zod before anything reaches a crontab line; `deploy.sh` re-checks both patterns.
- **deploy.sh.** New step `settings` after `files` (before the restore window closes: a bad `deploy.json` puts the
  files back). Hooks: `pre-migrate` after the counts and before the switch (a failure restores the files; the switch's
  migrate service still runs after it), `post-up` after `tag` and `cron` (the release is live; a failure reports
  `result|failed|<hook>` and rolls nothing back), `maintain` after the images step; each prints `step|<name>|ok`, its
  own output goes to stderr (it can never print a step or result line), and runs with `TAG`, `IMAGE`,
  `PREVIOUS_TAG` in the app folder. `compose-exec`: `pg_dump` and `psql` run in the postgres service as
  `POSTGRES_USER` (default postgres) on `POSTGRES_DB` (default the app's name) from `.env.prod`, piped into the CLI's
  `--stdin` modes; the dump goes to a hidden file in the backup folder first and reaches `backup --stdin` only after
  `pg_dump` succeeded (plan review F1); only `host` reads `POSTGRES_PASSWORD` (F2); a missing app journal in the image
  fails the schema step by name (F4); `maintain <name>` of an unknown hook fails (F5). `host` stays as today. The CLI (host `npx` or the helper image, now with `--interactive` for piped
  input) is also present in the template without a database, used only when the release's `deploy.json` has hooks; that
  helper image has no Postgres client. The forced command accepts `maintain <name>`.
- **Prebuilt image (1).** Input `prebuilt-image: <image>@sha256:<64 hex>` (the same repository as `image`, refused with
  `e2e`). The build job then skips checkout and build, logs in and runs `docker buildx imagetools create --tag
  <image>:<tag> <prebuilt>`, checks with `imagetools inspect` that the tag now has that digest, and outputs `image` and
  `digest` as a build would. Everything after (deploy by tag, report) is unchanged.
- **Wording.** README sections that name the adopting app become neutral while the README is edited (Parity section
  renamed to the adopting app's release scripts); comments touched in this change likewise.

## Phase 1: CLI (TDD)

Files: `src/db/snapshot-query.ts` (+test), `src/db/schema-guard.ts`, `src/db/row-counts.ts`, `src/db/backup.ts`,
`src/cli/db-commands.ts`, `src/cli/env-command.ts`, `src/cli/io.ts`, `src/cli/main.ts`, `src/cli/run.ts` (usage),
`src/db/index.ts`, `src/index.ts`, `tests/db-cli.test.ts`, `tests/cli.test.ts`.

- `CliIo` gains `stdin: () => NodeJS.ReadableStream`; `main.ts` passes `process.stdin`; tests pass `Readable.from`.
- Tests first: print-query output; stdin guard passes/refuses (module ledger, app ledger fewer/equal/more, no table);
  row-counts stdin compare; backup stdin keeps a PGDMP stream, refuses an empty or foreign one and runs retention;
  env render from JSON (precedence, unset, not an object, non-string ignored, no value printed); on Postgres the
  snapshot statements against real tables (absent tables, base64 round trip) and the connection-mode guard with an
  app ledger.

Done when: `npx vitest run tools/deploy` green with `SOFTURE_TEST_POSTGRES_URL`, typecheck and lint green.

## Phase 2: deploy.json, server-settings, deploy.sh (TDD)

Files: `src/verify/schema.ts` (+`tests/schema.test.ts`), `src/cli/server-settings-command.ts`, `src/cli/run.ts`,
`templates/docker/server/deploy.sh.tmpl`, `src/init/generate.ts` (if a value is needed), `schema/deploy.schema.json`
(`npm run schema`), `e2e/app/` (`npm run e2e-app`), `tests/server-files.test.ts`.

- The stub `npx` runs the real CLI for `server-settings` and `--print-query` (tsx), the stub `docker` answers
  `compose … exec -T postgres pg_dump|psql` with a PGDMP header and canned JSON.
- Tests: hooks run in order at their points with their step lines and output on stderr; a failing `pre-migrate`
  restores the files; a failing `post-up` reports failed with the tag recorded; a scheduled maintain hook gets its own
  crontab line and `maintain <name>` runs only it; an invalid `deploy.json` stops at `settings` with files restored;
  compose-exec runs backup, guard and counts through `compose exec` with the env's user and database; the app journal
  is copied from the image and passed to the guard; the no-database template runs hooks.

Done when: deploy tests green, `e2e-scripts.test.ts` agrees with the regenerated `e2e/app/`.

## Phase 3: prebuilt image in deploy-app.yml (test-after)

Files: `.github/workflows/deploy-app.yml`, `tests/release-guards.test.ts`.

- Tests: the check step accepts an empty input and `<image>@sha256:<hex>`, refuses another repository, a tag
  reference and `e2e: true` with it; the re-tag step (stub `docker`) creates the tag from the digest, outputs image and
  digest, and fails when the inspected digest differs.

Done when: deploy tests green, the workflow parses (`yaml`), lint (actionlint is not in the gates; the YAML tests are).

## Phase 4: docs

Files: `tools/deploy/README.md`, `tools/deploy/CHANGELOG.md` (`## Unreleased`), `tools/deploy/examples/deploy.yml`,
`templates/.github/workflows/deploy.yml.tmpl` (a commented `prebuilt-image` line, if the e2e test of init allows).

Done when: all gates green (`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`).

## Progress

- [ ] Phase 1: CLI
- [ ] Phase 2: deploy.json, server-settings, deploy.sh
- [ ] Phase 3: prebuilt image in deploy-app.yml
- [ ] Phase 4: docs
