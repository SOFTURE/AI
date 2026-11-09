# Changelog

Newest first. Each version lists what changed for an app that uses the module. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done").

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
