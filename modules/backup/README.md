# @softure-ai/backup

Encrypted off-site copies of the nightly backup of [`@softure-ai/deploy`](../../tools/deploy/README.md), their status
for the app, and a restore and a weekly verify that need a private key the server never holds.

## 1. What it provides

- **`softure-backup upload`**, run by `deploy.sh maintain` right after the night's `pg_dump` (step `offsite-backup`):
  it encrypts the new dump (and the data archive, when the app has `data.backupPaths`) with
  [age](https://age-encryption.org) to a **public key** and PUTs it to any S3-compatible store (AWS S3, Cloudflare R2,
  Backblaze B2, Hetzner Object Storage, MinIO, SeaweedFS…) as `<prefix>/<file>.age`, with a **write-only token**. It
  never lists, reads or deletes anything remote: the bucket's lifecycle rule expires old copies. No second `pg_dump`,
  no extra compose service: it reuses the dump `maintain` already took.
- **A status row per run** in `backup.runs`: start and end time, result (`ok`, `failed`, `not_configured`), each
  object's key, size and sha256, and on failure a safe error code and message (no secret, no URL).
- **For the app:** `getLastBackup(db)` (the newest run and the newest successful one, for a settings screen),
  `listBackupRuns(db, { limit })`, `getLastSuccessAgeSeconds(status, now)`, `registerBackupMetrics({ db })`
  (OpenTelemetry gauges through `@softure-ai/observability`, among them the age of the newest good copy for an alert
  above 26 hours) and a health check of the table.
- **For the operator:** `softure-backup restore` (into a **new** database by default; over an existing one only with
  `--into=<db> --overwrite`), `softure-backup fetch` (decrypt one object, e.g. the data archive), `softure-backup
  verify` (newest copy → throwaway database → the deploy's schema guard and row counts → drop; meant to run weekly,
  see [examples/backup-verify.yml](examples/backup-verify.yml)) and `softure-backup lifecycle` (the bucket rule).
- The private key is read from a file or stdin only. An argument that holds `AGE-SECRET-KEY-` is refused, so the key
  never shows in `ps` or a shell history.

## 2. Installation

```bash
npm install @softure-ai/backup
```

Then add the module to `softure.config.ts` (section 3) and run `softure migrate`: the table is what the nightly run
writes its status into. The server does not need the package installed: `deploy.sh` runs the CLI with `npx` (or in
its helper tools image on a host without Node), at the version the deploy release pins.

## 3. Configuration

```ts
// softure.config.ts
import { backup } from "@softure-ai/backup";

export default defineConfig({
  modules: [/* … */, backup()],
});
```

There are no options: everything the off-site copy needs comes from the environment (section 6), so the code is the
same with and without it. An app that never sets `BACKUP_S3_BUCKET` sees `not_configured` and nothing fails.

**The deploy side.** `softure-deploy init` (0.7.0 and later) writes into the compose file of an app with a database an
`x-offsite-backup` block of optional names, which makes `env render` put them into `.env.prod`:

```yaml
x-offsite-backup:
  BACKUP_S3_ENDPOINT: ${BACKUP_S3_ENDPOINT:-}
  BACKUP_S3_REGION: ${BACKUP_S3_REGION:-}
  BACKUP_S3_BUCKET: ${BACKUP_S3_BUCKET:-}
  BACKUP_S3_PREFIX: ${BACKUP_S3_PREFIX:-}
  BACKUP_S3_ACCESS_KEY_ID: ${BACKUP_S3_ACCESS_KEY_ID:-}
  BACKUP_S3_SECRET_ACCESS_KEY: ${BACKUP_S3_SECRET_ACCESS_KEY:-}
  BACKUP_AGE_RECIPIENT: ${BACKUP_AGE_RECIPIENT:-}
```

No container gets these values: only `deploy.sh maintain` reads them on the host and hands them to the CLI's
environment. `deploy.json` needs nothing new; `database.rowCountTables` and `database.excludeTableData` are what
`verify --config=deploy.json` counts.

## 4. Mounting

Nothing to mount: no route or page. A settings screen reads the status on the server:

```ts
import { getLastBackup, getLastSuccessAgeSeconds } from "@softure-ai/backup/server";

const status = await getLastBackup(db); // { result, lastRun, lastSuccess }
const ageSeconds = getLastSuccessAgeSeconds(status, new Date()); // null until a run succeeded
```

Metrics, once at start-up next to `startObservability()`: `registerBackupMetrics({ db })`. The `@softure-ai/ops`
health route picks up the module's health check (the table exists and answers).

## 5. Migrations and tables

Schema `backup`, migration `0001_create_runs.sql`, table `backup.runs`: `id`, `started_at`, `finished_at`, `result`
(`ok`, `failed`, `not_configured`), `objects` (jsonb: kind `database` or `data`, key, bytes, sha256), `size_bytes`,
`error_code`, `error_message`. A constraint keeps an error exactly on failed runs. The host writes the rows through
`psql` as the Postgres superuser (`POSTGRES_USER`) and prunes rows older than 400 days in the same transaction; the
app only reads them.

## 6. Environment variables

On the server (`.env.prod`, from the deploy job), all optional; `BACKUP_S3_BUCKET` switches the off-site copy on:

| Name | What it is |
| --- | --- |
| `BACKUP_S3_ENDPOINT` | The store's S3 endpoint, `https://…` (`http://` only for a local store). |
| `BACKUP_S3_REGION` | The signing region; default `auto` (R2). AWS needs the bucket's region. |
| `BACKUP_S3_BUCKET` | The bucket. |
| `BACKUP_S3_PREFIX` | The folder in the bucket; default the app's name. One prefix per app, so apps can share a bucket. |
| `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY` | The **write-only** token (secret). |
| `BACKUP_AGE_RECIPIENT` | The age **public** key, `age1…`. Not a secret. |

On the operator's machine or the verify job, never on the server: the same endpoint, region, bucket and prefix, plus
`BACKUP_S3_READ_ACCESS_KEY_ID` and `BACKUP_S3_READ_SECRET_ACCESS_KEY` (the **read-only** token),
`BACKUP_RESTORE_DATABASE_URL` / `BACKUP_VERIFY_DATABASE_URL` (a superuser's `postgres://` URL of the Postgres to
restore into) and optionally `BACKUP_PG_RESTORE` (the `pg_restore` to run; it must be at least the server's major).
The private key is not an environment variable of the CLI: pass it with `--identity=<file>` or `--identity=-`.

Every name is validated with zod: some names set but not all, a bad endpoint, bucket, prefix or recipient is
`config_invalid`, listed by name and never by value. Secret values are redacted from every message.

## 7. Switches

None. Whether the copy runs is the presence of `BACKUP_S3_BUCKET` on the server.

## 8. Appearance

No components; the app renders `getLastBackup()` in its own UI.

## 9. Copy

`src/messages/en.ts` (`backupMessages`): a label per result (`result.ok`, `result.failed`, `result.not_configured`)
and a sentence per error code (`errors.config_invalid`, `file_missing`, `encrypt_failed`, `upload_denied`,
`upload_failed`, `network_error`) for a settings screen. English only; an app overrides them through its message
layer.

## 10. Hooks

None in the app. On the server the step is part of `maintain`; its line is `step|offsite-backup|ok|<n> object(s), <bytes>
bytes in <s> s` or `step|offsite-backup|ok|not configured`. A failed upload does not stop the steps after it (test
restore, cleanup, hooks); `maintain` then ends `result|failed|offsite-backup|<message>`, which the cron's mail or log
shows. When the app has no `backup.runs` table yet, the copy still runs and the step line ends `; status not recorded
(add @softure-ai/backup to the app and migrate)`.

## 11. GDPR

`backup.runs` holds no personal data. The copies hold the whole database, encrypted, so a person's erased data lives on
in them until the lifecycle rule expires them: keep the rule's days (default 30) in the privacy policy's retention
section. The module exports and deletes nothing for a user.

## 12. Limitations

- One PUT per file, up to 5 GiB per encrypted object (no multipart upload). A larger database needs a store-side
  replication instead.
- The write-only property is the token's: the CLI never reads or deletes, but only the provider can make the token
  unable to. Where a provider has no write-only key, turn on its object lock (section "Owner guide", step 2).
- `verify` needs the private key, so it cannot run in `maintain`: run it weekly from a CI job or the owner's machine.
  The server's own weekly `verify-backup` step keeps checking the local dump.
- Retention is the bucket's lifecycle rule only; nothing here deletes a remote object.

## Owner guide

What the owner does once per app (or once per bucket shared by several apps on one server, each with its own prefix).

1. **Bucket.** Create a private bucket in a region other than the server's, e.g. `acme-backups`. No public access, no
   website hosting. Note its S3 endpoint (R2: `https://<account id>.r2.cloudflarestorage.com`, region `auto`; B2:
   `https://s3.<region>.backblazeb2.com`; AWS: `https://s3.<region>.amazonaws.com`; Hetzner:
   `https://<location>.your-objectstorage.com`).
2. **Write-only token** for the server, limited to that bucket:
   - AWS: an IAM user with only `s3:PutObject` on `arn:aws:s3:::acme-backups/<prefix>/*`.
   - Backblaze B2: an application key restricted to the bucket with the single capability `writeFiles`.
   - MinIO / SeaweedFS: a user or identity with a `PutObject`-only (`Write:<bucket>`) policy.
   - A provider whose keys cannot be write-only (Cloudflare R2's object tokens read and write; Hetzner's keys are
     per project): scope the key to the bucket and turn on the bucket's object lock / bucket lock rule for at least
     the retention days, so a stolen key can neither delete nor overwrite a copy.
3. **Read-only token** for restore and verify, separate from the write one: AWS `s3:GetObject` on the prefix plus
   `s3:ListBucket` on the bucket; B2 `readFiles` + `listFiles`; R2 "Object Read only". It never goes to the server.
4. **Lifecycle rule** (the only remote retention): `npx @softure-ai/backup lifecycle --app=<prefix> --days=30` prints
   the S3 XML (`--format=json` for `aws s3api put-bucket-lifecycle-configuration`); on R2 and B2 set the same in the
   bucket's settings (expire objects with prefix `<prefix>/` after 30 days).
5. **age key pair**, on the owner's machine: `age-keygen -o backup-key.txt`. The `# public key: age1…` line is
   `BACKUP_AGE_RECIPIENT`. Keep `backup-key.txt` offline (a password manager and a printed copy), never on the server
   and never in the deploy's environment. Losing it makes every copy unreadable.
6. **Secrets in the GitHub Environment** of the deploy (e.g. `production`): secrets `BACKUP_S3_ACCESS_KEY_ID`,
   `BACKUP_S3_SECRET_ACCESS_KEY`; variables `BACKUP_S3_ENDPOINT`, `BACKUP_S3_REGION`, `BACKUP_S3_BUCKET`,
   `BACKUP_S3_PREFIX`, `BACKUP_AGE_RECIPIENT`. The deploy job must pass them on: name the two secrets in the deploy
   action's `secret-names` (or the caller's `app-secrets`) and the variables in `app-vars`
   ([deploy workflow](../../tools/deploy/README.md#deploy-workflow)). The next release writes them into `.env.prod`;
   the next night's `maintain` uploads.
7. **Weekly verify:** copy [examples/backup-verify.yml](examples/backup-verify.yml) into the app's repository with its
   own GitHub Environment `backup-verify` (read token, prefix, and the private key as `BACKUP_AGE_IDENTITY` if the
   owner accepts it there), or run `verify` by hand on the owner's machine each week.
8. **Alert** on the metric: `softure_backup_last_success_age_seconds > 93600` (26 h) for 15 minutes, and on
   `softure_backup_last_run_ok == 0`.

### Restore and verify

```bash
export BACKUP_S3_ENDPOINT=… BACKUP_S3_REGION=… BACKUP_S3_BUCKET=… BACKUP_S3_PREFIX=acme-app
export BACKUP_S3_READ_ACCESS_KEY_ID=… BACKUP_S3_READ_SECRET_ACCESS_KEY=…
export BACKUP_RESTORE_DATABASE_URL=postgres://postgres:…@127.0.0.1:5432/acme_app

# The newest copy into a new database acme_app_restore_<yyyymmddhhmmss>, named after the URL's database (nothing
# existing is touched):
npx @softure-ai/backup restore --identity=backup-key.txt
# A given copy: --key=acme-app/db-20261109T031700Z.dump.age; over an existing database: --into=acme_app --overwrite

# The weekly check: restore, schema guard, row counts, drop (BACKUP_VERIFY_DATABASE_URL instead):
npx @softure-ai/backup verify --identity=- --config=deploy.json --migrations-dir=softure-migrations < backup-key.txt
```

### After losing the server

1. Provision the new server as the first time (host playbook, DNS), and run the deploy workflow for the last
   release's tag. That first release starts Postgres with the app's roles (`initdb/01-roles.sql`), migrates an empty
   database and starts the app.
2. On the owner's machine, decrypt the newest copies (read token and key as above):
   `npx @softure-ai/backup fetch --identity=backup-key.txt --kind=database --out=db.dump`, and with a data volume
   `npx @softure-ai/backup fetch --identity=backup-key.txt --kind=data --out=data.tar.gz`.
3. Copy them to the server (`scp db.dump data.tar.gz admin@host:/tmp/`) and, as the admin user in `/srv/<app>`:
   stop the app and worker (`docker compose --env-file .env.prod stop app worker`), restore over the empty database
   (`docker compose --env-file .env.prod exec -T postgres pg_restore --clean --if-exists --exit-on-error -U postgres
   -d <database> < /tmp/db.dump`), and unpack the data archive into the data volume
   (`docker compose --env-file .env.prod run --rm --no-deps -T -v /tmp:/in --entrypoint tar app -xzf /in/data.tar.gz
   -C <data path>`).
4. Start everything again (`docker compose --env-file .env.prod up -d`), check `GET /api/health`, then delete
   `/tmp/db.dump` and `/tmp/data.tar.gz` (they are not encrypted).
5. The next night's `maintain` uploads again under the same prefix; `getLastBackup()` shows it the morning after.

## Build

`npm run build -w modules/backup` runs `tsc -p tsconfig.build.json`. Releasing:
[scripts/release/README.md](../../scripts/release/README.md).
