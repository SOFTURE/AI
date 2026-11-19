# Changelog

Newest first. Each version lists what changed for an app that uses the module. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

## 0.1.3

- **`examples/backup-verify.yml` checks the live release and reports a failure (#1386).** `IMAGE` is the app's image
  without a tag; the workflow walks the newest 20 published releases (no drafts, no pre-releases) and takes the first
  whose tag the registry holds (`docker manifest inspect`, after the registry login). Before, a run that started after
  a release was published and before its deploy tagged the image failed with `not found`, and the week went
  unchecked. With `issues: write`, a failed run creates the `backup-verify` label and opens one issue with the run's
  link (assigned to the repository's owner where GitHub allows it) or comments on the open one; a green run closes
  them. The example runs `softure-backup verify` of this version. To follow it, an app copies the new steps, the
  `issues: write` permission and the tagless `IMAGE` into its own copy.

## 0.1.2

- The module's manifest declares `runtimes: ["node", "workers"]`, matching the Workers-safe entries its package already
  lists (`.` and `./server` in `softure.workers`). Before it, `defineSoftureConfig` refused `backup()` in an app with
  `platform: { host: "cloudflare" }` ("does not run on the workers runtime"), so an app on Cloudflare could not create
  `backup.runs` for `softure-backup run`. A repository test now holds every module's manifest to its package's
  `softure.workers`.

## 0.1.1

- **`softure-backup run` for a host without a server (RP-9):** the whole night's copy in one command for an app on
  Cloudflare Workers, run from a scheduled workflow. It dumps the database at `BACKUP_DATABASE_URL` with
  `pg_dump --format=custom` (to stdout, so `BACKUP_PG_DUMP` can be a `postgres:<major>` wrapper; `--config=deploy.json`
  leaves out `database.excludeTableData`), uploads it with the same code, key names and write-only token as `upload`,
  and writes the same row into `backup.runs` over the same URL. A failed dump is recorded as `dump_failed` and nothing
  is uploaded; a row that cannot be written fails the run. The reader side is unchanged and now declared
  Workers-safe (`.` and `./server` in `softure.workers`), so `getLastBackup()` and the gauges run on either host.
- Database URLs (`BACKUP_DATABASE_URL`, `BACKUP_RESTORE_DATABASE_URL`, `BACKUP_VERIFY_DATABASE_URL`) and their
  passwords are redacted from every message, as the S3 secrets already were.

## 0.1.0

- **First version (#1210):** encrypted off-site copies of the nightly backup of `@softure-ai/deploy`. `softure-backup
  upload` encrypts the night's dump (and data archive) with `age` to `BACKUP_AGE_RECIPIENT` and PUTs it to any
  S3-compatible store (R2, B2, Hetzner, MinIO, AWS) under `<prefix>/<file>.age` with a write-only token; it never
  lists, reads or deletes, and the bucket's lifecycle rule (`softure-backup lifecycle`) expires old copies. Each run
  is recorded in `backup.runs` (the module's migration): time, result (`ok`, `failed`, `not_configured`), objects
  with size and sha256, a safe error code and message. The app reads it with `getLastBackup()` and
  `listBackupRuns()` and exports `registerBackupMetrics()` gauges (`softure.backup.last_success.age` for an alert
  above 26 h). `softure-backup restore` restores into a new database unless `--overwrite --into=<db>`;
  `softure-backup verify` restores the newest copy into a throwaway database, runs the deploy's schema guard and row
  counts and drops it; `fetch` decrypts a data archive. The private key comes from a file or stdin only.
