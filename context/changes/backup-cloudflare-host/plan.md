# Plan: backup-cloudflare-host

## Approach

One interface, two producers. The app and the operator see the same thing on every host: the `BACKUP_*` names, the
objects in the bucket, the `backup.runs` row, `getLastBackup` and the gauges, `restore` and `verify`. Only what
produces the night's copy differs: on a VPS `deploy.sh maintain` dumps and calls `softure-backup upload`; on
Cloudflare a new `softure-backup run` dumps the database over its URL itself, uploads with the same code and writes
the same row over the same URL. A composite action runs it nightly from GitHub, and `init --host=cloudflare` writes
the caller workflows.

## Decisions (auto)

- **`softure-backup run`, not a second upload path.** It reuses `uploadBackups` and `buildStatusSql`; only the dump
  (`pg_dump --format=custom` to stdout, `PG*` variables from `BACKUP_DATABASE_URL`, `--exclude-table-data` from
  `deploy.json`) and the recording (the status SQL over a connection) are new. The VPS path is unchanged.
- **The dump goes to stdout**, so a `docker run postgres:<major> pg_dump` wrapper (`BACKUP_PG_DUMP`) works as
  `BACKUP_PG_RESTORE` does for verify. The file is named `db-<YYYYMMDD>T<HHMMSS>Z.dump`, so objects sort with the VPS's.
- **A run that cannot record its row fails** (exit 1) after the upload: an unrecorded copy would read as missing.
  Not configured is recorded and exits 0, as on the VPS.
- **A composite action `.github/actions/backup-cloudflare`**, for the same reason as RP-8: the app's job names its
  Environment and passes secrets by name. Inputs: `app`, `database-url`, `postgres-major` (17), `deploy-config`,
  `backup-cli-version`. It runs on `ubuntu-latest` (it holds production secrets).
- **`init --host=cloudflare` with a database writes `.github/workflows/backup.yml`** (nightly 03:17 UTC, Environment
  `production`, `MIGRATE_DATABASE_URL` and the write-only token) **and `.github/workflows/backup-verify.yml`** (weekly,
  Environment `backup-verify`, the migrations exported from the checkout with `softure migrate --export-migrations`
  instead of copied from an image).
- **Declare `.` and `./server` of `@softure-ai/backup` Workers-safe**; `./offsite` and the CLI stay Node.
- backup 0.1.0 → 0.1.1; deploy stays 0.7.1, which RP-8 set and which is not yet published, so the init change joins it.

## Phase 1: `softure-backup run` (test-after)

- `src/offsite/dump.ts`: `runPgDump({ url, out, excludeTableData, pgDump, env })`.
- `src/offsite/record.ts`: `recordRun(url, record)` runs `buildStatusSql(record)` over `withPgClient`.
- `src/cli/run.ts`: `run --app=<name> [--config=deploy.json] [--summary=<file>]`; `BACKUP_DATABASE_URL` required;
  dump into a private temp directory, upload, record, remove the directory.
- `package.json`: `softure.workers: [".", "./server"]`; version 0.1.1; CHANGELOG; README section.
- Tests: unit tests with a fake `pg_dump` script, the fake S3 and a recording seam; the real-Postgres path in
  `tests/offsite-postgres.test.ts` (dump, upload, row in `backup.runs`, restore of that copy).
- **Done when:** `npx vitest run modules/backup tests/repo` is green, including the Workers-entries guard.

## Phase 2: the action and init (test-after)

- `.github/actions/backup-cloudflare/action.yml`, `tests/repo/backup-cloudflare-action.test.ts` with a fake `docker`
  and `npx`; `macos.yml` lists the test.
- `tools/deploy/templates/cloudflare/.github/workflows/backup.yml.tmpl` and `backup-verify.yml.tmpl`, in
  `CLOUDFLARE_TEMPLATE_FILES` when the app has a database; `next` names the Environment settings; tests in
  `tools/deploy/tests/init-cloudflare.test.ts`.
- Docs: the backup README ("On Cloudflare"), the matrix row and move steps in `docs/07-runtime-providers.md`.
- **Done when:** `npx vitest run tests/repo tools/deploy modules/backup`, typecheck, lint and the language gate pass.

## Progress

- [x] Phase 1: `softure-backup run` (152f4da)
- [ ] Phase 2: the action and init
