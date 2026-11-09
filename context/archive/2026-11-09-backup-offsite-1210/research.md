---
change_id: backup-offsite-1210
---

# Research

## The nightly backup today (`tools/deploy/templates/docker/server/deploy.sh.tmpl`)

- `maintain` (cron `17 3 * * *`, `flock` on `.deploy.lock`): `settings` → `backup` (`back_up_database`: host access
  runs `npx @softure-ai/deploy backup --dir=backups --prefix=db --keep=7 --max-age-days=30`; compose-exec dumps through
  `compose exec postgres pg_dump` into a hidden file and pipes it to `backup --stdin`) → `backup-data`
  (`data-<stamp>.tar.gz`, only with `--data-volume` and `data.backupPaths`) → `verify-backup` (weekly by default:
  restore into `softure_verify_backup` of the same Postgres as its superuser, compare row counts) → cleanup steps →
  maintain hooks. `fail` exits at once; `finish` prints `result|ok` or `result|failed|<step>|<message>`.
- The dump file name comes back in `backup_file` (`db-<YYYYMMDDTHHMMSSZ>.dump`); the data archive name is only in its
  step line.
- The CLI runs through `npx --yes @softure-ai/deploy@<v>` on a host with Node, else in the helper image
  `softure-deploy-tools:<v>-pg<major>` (node:22-alpine + postgresql client + the CLI), which passes only
  `DATABASE_URL` from the environment (`run_in_tools`).
- `.env.prod` holds only the names the compose file uses: `${NAME:?}` required, `${NAME:-}` optional (rendered when the
  deploy environment sets it; `tools/deploy/src/env/required-names.ts`). Host-only settings therefore need an
  optional mention in the compose file; a top-level `x-` extension field is interpolated and ignored by compose.
- Tests: `tools/deploy/tests/server-files.test.ts` runs the generated script with stub `docker`, `npx`, `date`,
  `flock` and `crontab` and asserts step lines and logged calls.

## Reusable pieces

- `@softure-ai/deploy` exports `toLibpqEnv`, `withPgClient`, `countRows`, `parseTableList`, `guardSchema` and
  `parseDeployConfig`: verify can reuse the deploy's own schema guard and row counts.
- Modules keep state in their own schema through `migrations/` (`defineModule`, `resolveMigrationsDir`); the migrator
  role owns the tables and default privileges give the app role SELECT/INSERT/UPDATE/DELETE (initdb `01-roles.sql`).
  The postgres service's superuser (POSTGRES_USER, else `postgres`) can write any table.
- `@softure-ai/observability` `createLogger` writes one console line and an OpenTelemetry record; metrics come from
  `@opentelemetry/api` (`metrics.getMeter`), exported when the app runs `startObservability`.

## Libraries

- `age-encryption` 0.3.1 (typage, by the age author): pure JS, `Encrypter.encrypt(ReadableStream)` and
  `Decrypter.decrypt(ReadableStream)` stream, X25519 `age1…` recipients, `AGE-SECRET-KEY-1…` identities. Interoperable
  with the `age` CLI.
- S3: every target (R2, B2, Hetzner, MinIO, AWS) accepts path-style SigV4 `PUT`, `GET` and `ListObjectsV2`. A single
  `PUT` takes up to 5 GiB, far above a small app's dump; signing the real payload sha256 (already computed for the
  status) needs no `UNSIGNED-PAYLOAD`. A write-only token (R2 "Object Write", B2 `writeFiles`, an IAM policy with only
  `s3:PutObject`) is enough for a single `PUT`. The AWS SDK would add ~10 MB for three requests.

## Environment of this run

- No Docker Hub pulls (rate limited) and no MinIO binary here: the local check of the integration path uses the
  container's PostgreSQL 16 tools and an in-process fake S3; the Postgres 17 + MinIO run is a CI job.
