---
change_id: backup-offsite-1210
status: planned
---

# Plan: encrypted off-site copies of the nightly backup (issue #1210)

Input: change.md, research.md. Complexity: large.

## Goal

`@softure-ai/backup` encrypts and uploads each nightly dump, records a status the app reads, and restores or verifies
an off-site copy; `deploy.sh maintain` runs it when configured and skips it otherwise.

## Approach

A new module `modules/backup` (status table through its own migration) that also ships the CLI `softure-backup`:

- `src/config.ts`: zod schemas over the environment. Upload: `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION` (default
  `auto`), `BACKUP_S3_BUCKET`, `BACKUP_S3_PREFIX` (default the app name), `BACKUP_S3_ACCESS_KEY_ID`,
  `BACKUP_S3_SECRET_ACCESS_KEY`, `BACKUP_AGE_RECIPIENT`. Read (restore, verify, fetch): the same store with
  `BACKUP_S3_READ_ACCESS_KEY_ID` and `BACKUP_S3_READ_SECRET_ACCESS_KEY`. Every name unset → `not_configured`; some set
  → a readable list of what is missing or wrong, never a value.
- `src/s3.ts`: path-style SigV4 `PUT` (payload sha256 signed), `GET` (stream) and `ListObjectsV2`; S3 error code and
  HTTP status kept for the safe error.
- `src/crypto.ts`: `age-encryption` streams; the identity is read from a file or stdin, never argv.
- `src/objects.ts`: object key `<prefix>/<file name>.age`, accepting only the deploy's names
  (`db-<stamp>.dump`, `data-<stamp>.tar.gz`); newest selection by the stamp in the name.
- `src/upload.ts`: per file encrypt to a `0600` temporary file next to the source, sha256 and size, `PUT`, remove;
  result `ok` or `failed` with a code (`config_invalid`, `file_missing`, `encrypt_failed`, `upload_denied`,
  `upload_failed`, `network_error`) and a message with every configured secret redacted.
- `src/status-sql.ts` + `migrations/0001_create_runs.sql`: table `backup.runs` (started/finished, result, objects as
  jsonb, total size, error code and message); the CLI writes one parameter-free `INSERT` (literals quoted) plus a prune
  of rows older than 400 days to a file; `deploy.sh` runs it through psql in the postgres service as its superuser.
  Chosen because the app's own database is the only store both the host run and the app already reach.
- `src/server/`: `getLastBackup(db)` and `listBackupRuns(db, { limit })` (result `not_configured` when no run is
  recorded), `registerBackupMetrics(db)`: observable gauges `softure.backup.last_success_age` (s),
  `softure.backup.last_run.ok`, `softure.backup.last_run.size` (By), `softure.backup.last_run.duration` (s).
- `src/restore.ts`: download → decrypt → `pg_restore --exit-on-error` into a new database `<base>_restore_<stamp>` by
  default; an existing database only with `--overwrite` (`--clean --if-exists`). The admin URL comes from
  `BACKUP_RESTORE_DATABASE_URL`, given to `pg_restore` as libpq variables.
- `src/verify.ts`: newest db object (fails when older than `--max-age-hours`, default 26) → throwaway database →
  `pg_restore --no-owner --no-acl --exit-on-error` → the deploy's schema guard with `--migrations-dir` → row counts of
  deploy.json `rowCountTables` less `excludeTableData` (a missing table fails) → drop. URL from
  `BACKUP_VERIFY_DATABASE_URL`. Runs where the private key is: the operator's machine or a scheduled GitHub Actions
  job with a Postgres service (an example workflow ships), never in `maintain`, since the private key must not reach
  the server.
- CLI `softure-backup`: `upload --app=<name> --file=<path>… [--status-sql=<file>]`, `restore`, `verify`, `fetch`
  (decrypt one object to a file, for data archives), `lifecycle --days=<n>` (prints the S3 lifecycle rule, 1 to
  3650 days).
- deploy: `deploy.sh maintain` gets the step `offsite-backup` after `backup`/`backup-data`: `BACKUP_S3_BUCKET` unset in
  `.env.prod` → `step|offsite-backup|ok|not configured` with no CLI start; else the CLI (npx, or the helper image which
  now also installs it and passes the `BACKUP_*` names) uploads the run's dump and data archive, the status SQL goes
  through psql (a missing table is a warning in the step line). A failed upload does not stop verify-backup, cleanup
  or hooks; the run then ends `result|failed|offsite-backup|<message>`. init writes an `x-offsite-backup` block of
  optional `${BACKUP_…:-}` names into the compose file, so `env render` carries them to `.env.prod`.

Rejected: the AWS SDK (size for three requests); a JSON status file on the host (the app container cannot read it);
the `age` binary (not on every host or in the helper image); verify inside `maintain` (needs the private key on the
server).

## Phase 1: the package core

**Discipline:** TDD. **Files:** `modules/backup/**` (config, s3, crypto, objects, upload, status-sql, migration,
server, module definition, messages, README skeleton).
Done when unit tests cover config validation, object naming, SigV4 (AWS's published example), status SQL (quoting,
prune boundary), lifecycle bounds, upload against a local fake S3 that checks signatures, and `getLastBackup` on
PGlite.

## Phase 2: restore, verify, fetch and the CLI

**Discipline:** test-after. **Files:** `modules/backup/src/{restore,verify,cli}/**`, tests.
Done when a local run against the container's Postgres and the fake S3 goes dump → upload → status → restore →
verify, and the CLI refuses argv secrets, an existing database without `--overwrite` and a missing identity.

## Phase 3: deploy hook

**Discipline:** TDD. **Files:** `tools/deploy/templates/**`, `tools/deploy/src/init/**`, `tools/deploy/tests/**`.
Done when the script tests cover not configured (no CLI call), configured (env not argv, both files, status through
psql), a failed upload (later steps run, result failed), a missing status table (warning) and the helper image.

## Phase 4: integration test, docs, release prep

**Files:** `modules/backup/tests/integration/**`, `.github/workflows/e2e.yml`, `scripts/ci/affected.mjs`, READMEs,
CHANGELOGs, `tests/repo/release-tags.test.ts`.
Done when the Postgres 17 + MinIO job is green in CI, the README covers bucket, tokens, key, secrets and a
server-loss restore, and the gates pass.

## Risks and rollback

- A wrong upload costs nothing locally: the local dump and retention are untouched. Rollback: unset
  `BACKUP_S3_BUCKET` (the step is skipped) or redeploy the previous deploy.sh.
- The status table is optional: an app that never adds the module gets a warning in the step line only.

## Decisions (auto)

- The status lives in the app's database (`backup.runs`), written as the postgres superuser by the host run.
- Verify does not run in `maintain`; a scheduled CI job or the operator runs it (private key off the server).
- Own SigV4 client, single `PUT` up to 5 GiB (README limitation).
- One run row holds every object of the run (dump and data archive) as jsonb.
- The init compose block is written for every app with a database; optional names cost nothing when unset.

## Progress

### Phase 1: the package core

#### Automated
- [ ] 1.1 Unit tests for config, objects, SigV4, status SQL, lifecycle, upload (fake S3), status reads
- [ ] 1.2 Gates green for the package (typecheck, lint, test)

### Phase 2: restore, verify, fetch and the CLI

#### Automated
- [ ] 2.1 Local end-to-end with Postgres and the fake S3
- [ ] 2.2 CLI refusals tested

### Phase 3: deploy hook

#### Automated
- [ ] 3.1 server-files and init tests extended, bash 3.2 syntax kept
- [ ] 3.2 Gates green

### Phase 4: integration test, docs, release prep

#### Automated
- [ ] 4.1 Postgres 17 + MinIO integration job green in CI
- [ ] 4.2 README, CHANGELOGs, package count test

#### Manual
- [ ] 4.3 Real provider bucket and tokens (owner only: the owner's provider account and secrets)
