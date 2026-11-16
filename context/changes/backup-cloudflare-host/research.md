# Research: backup-cloudflare-host

## How it works today

- `deploy.sh maintain` (VPS) takes the night's `pg_dump --format=custom` inside the postgres service
  (`database.access: compose-exec`, no published port), leaves out `database.excludeTableData`, then runs
  `softure-backup upload --app=<name> --file=<dump> [--file=<data archive>] --status-sql=… --summary=…`
  (`tools/deploy/templates/docker/server/deploy.sh.tmpl`, `back_up_offsite`). The CLI encrypts each file with age to
  `BACKUP_AGE_RECIPIENT`, PUTs it with the write-only token (`BACKUP_S3_*`) and writes the run as one SQL file
  (`buildStatusSql`), which deploy.sh pipes into psql as the superuser.
- Object names must match the deploy's own names (`<prefix>-<YYYYMMDD>T<HHMMSS>Z.dump`,
  `src/offsite/objects.ts`), so a key sorts by time; retention is the bucket's lifecycle rule.
- The app reads `backup.runs` through `getLastBackup`, `listBackupRuns`, `registerBackupMetrics` and the health
  check (`src/server/index.ts`). Restore, fetch and verify run anywhere with a read token and the private key;
  `examples/backup-verify.yml` runs verify weekly on a GitHub runner against a throwaway Postgres service, with the
  migrations copied out of the live image.
- `@softure-ai/backup` declares no `softure.workers` entry (RP-7 left it out).

## What a Cloudflare app lacks

There is no server, so nothing runs the nightly `pg_dump` and nothing pipes the status SQL into psql. Everything after
the dump is host-neutral already: the same encryption, upload, object names, `backup.runs` row and reader API.

## Findings

- `toLibpqEnv(url)` (`@softure-ai/deploy`) maps a URL to `PG*` variables, `sslmode` included (`PGSSLMODE`), so
  `pg_dump` can run with no password in its arguments, as `runPgRestore` already does.
- A GitHub runner's `pg_dump` (16 on ubuntu-latest) is older than a managed Postgres 17, and pg_dump refuses a newer
  server. The verify example solves the same problem for `pg_restore` with a `docker run postgres:<major>` wrapper;
  a wrapper cannot write a `--file` on the runner, so the dump must go to stdout.
- The status row needs a connection that may insert into `backup.runs`: the direct database URL the Cloudflare deploy
  already keeps as `MIGRATE_DATABASE_URL` in the `production` Environment (RP-8) is the migrator, which owns the table.
- The reader side (`.` and `./server`) imports `@opentelemetry/api`, core, db, the observability root and
  drizzle; all of them are Workers-safe entries (RP-1, RP-2, RP-6), so the app's status card and gauges can run on
  Workers once the entries are declared.
- `softure-deploy init --host=cloudflare` (RP-8) writes the deploy caller; it can write the backup and verify callers
  the same way, next to the VPS's `x-offsite-backup` block, which the Cloudflare host does not have.

## SOFTURE modules that already cover the need

`@softure-ai/backup` itself (upload, record, read, restore, verify) and `@softure-ai/deploy` (`toLibpqEnv`,
`withPgClient`, `parseDeployConfig`, init). Nothing new outside them.
