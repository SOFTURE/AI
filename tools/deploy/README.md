# @softure-ai/deploy

Deploy CLI for an app that runs on one VPS with Docker Compose. It holds the steps that do not change from app to
app; what describes one app (compose file, Traefik rules, Dockerfile) stays in the app
([docs/06-fire-extraction-2.md](../../docs/06-fire-extraction-2.md), "Deploy: package or template").

```bash
npm install --save-dev @softure-ai/deploy
npx softure-deploy help
```

## `softure-deploy env render`

Writes the production env file from the environment, for every variable the compose file requires.

```bash
softure-deploy env render [--compose=docker/prod/docker-compose.yml] [--out=.env.prod]
```

- **Names come from the compose file:** every `${NAME:?…}` (refuses an unset or empty value) and `${NAME?…}`
  (refuses only an unset one) is required. `${NAME:-default}` and `${NAME-default}` are optional: written when the
  environment sets them to a non-empty value, left out otherwise (the compose default applies), so a runtime switch
  such as `ADMIN_EMAILS` reaches the server without blocking a release that does not set it. A name required anywhere
  in the file is required. Bare `${NAME}` (it also names what the server script sets, like `${TAG}`) and escaped
  `$${…}` are skipped, so the compose file stays the one list of what production reads.
- **Values come from the environment** (in CI: `env:` from the repository secrets). A missing name stops the
  command with every missing name listed; nothing is written.
- **Values are never printed**, on success or on failure: the output names variables and counts only
  (`wrote 3 names (1 of 2 optional set) …`).
- The file starts with a comment (`# Written by softure-deploy env render …; do not edit on the server.`): it is
  rewritten on every release.
- The file is written with mode `0600`, through a temporary file and a rename. A value is written bare when compose
  reads it literally, else single-quoted (compose does not interpolate inside single quotes). A value with a newline
  or a single quote has no literal one-line form and is refused by name.

```yaml
# In a deploy job
- run: npx softure-deploy env render
  env:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
```

## `softure-deploy release-notes`

The release report between two tags, in Markdown, ready for a GitHub Release body.

```bash
softure-deploy release-notes [--to=HEAD] [--from=<tag>] [--match=<glob>] [--repo-url=<url>] [--locale=en|pl] [--out=<file>]
                             [--roadmap=context/foundation/roadmap.md] [--body=<release body file>]
```

- **Range:** `--from` defaults to the nearest tag before `--to` that matches `--match` (a git glob, default `*`;
  `v*` or `app@*` when the repository has other tags). With no earlier tag the report starts at the first commit.
- **Source:** `git log --first-parent` only, no GitHub token. Each first-parent commit is one line:
  - a pull request when it is a GitHub merge (`Merge pull request #N from …`, title from the body), a squash merge
    or a merge commit ending in `(#N)` (`Merge <branch>: <title> (#N)` keeps only the title);
  - an "other commit" otherwise; base syncs (`Merge branch '…'`) are left out.
- **Links:** `--repo-url`, else `GITHUB_SERVER_URL/GITHUB_REPOSITORY` inside GitHub Actions, else none (plain `#N`
  and short SHAs).
- **Copy:** `en` and `pl` dictionaries (`deployMessages`), exported for apps that format the report themselves.
- **Roadmap items:** `--roadmap=<file>` adds a `### Roadmap items` table after the summary: the rows of the SOFTURE
  roadmap's `## At a glance` table whose status is `done_code` (on the main branch, waiting for this release), with
  their ID, change and outcome. A missing file fails; a release with no such row has no table.
- **Inside a release body:** `--body=<file>` reads the release's current body (a missing file is an empty one) and
  writes the report between `<!-- softure-deploy:release-notes -->` and `<!-- /softure-deploy:release-notes -->`:
  replaced in place on a rerun, appended after the owner's text on the first run, the text around it kept. The
  result goes to `--out` or stdout, ready for `gh release edit --notes-file`.

```markdown
## v1.2.0 (2026-10-05)

Changes since v1.1.0: 2 pull requests, 1 other commits.

### Pull requests

- Trial ends at midnight ([#12](https://github.com/acme/app/pull/12))
- Export to CSV ([#11](https://github.com/acme/app/pull/11))

### Other commits

- fix: typo in the footer ([`0123456`](https://github.com/acme/app/commit/0123456…))

[Full diff](https://github.com/acme/app/compare/v1.1.0...v1.2.0)
```

## Database steps around a deploy

`backup`, `schema-guard` and `row-counts` read the database URL from `DATABASE_URL` (`--url-env=<NAME>` names
another variable). The URL is never printed; a driver error prints its message only. A server `deploy.sh` runs them
in this order:

```bash
softure-deploy backup --dir=/srv/app/backups --keep=7                   # 1. dump, then retention
docker compose run --rm --no-deps app \
  npx softure-deploy schema-guard --migrations-dir=/app/migrations      # 2. in the NEW image, before the switch
softure-deploy row-counts --tables=users,billing.subscriptions --out=counts-before.json   # 3.
docker compose up -d app && docker compose run --rm app node migrate.js  # 4. switch and migrate (the app's own)
softure-deploy row-counts --tables=users,billing.subscriptions --compare=counts-before.json  # 5.
```

### `softure-deploy backup`

```bash
softure-deploy backup [--dir=backups] [--prefix=db] [--keep=7] [--max-age-days=<n>] [--exclude-table-data=<a,b.c>]
                      [--url-env=DATABASE_URL] [--pg-dump=pg_dump]
```

- Runs `pg_dump --format=custom` (restore with `pg_restore`) into `<dir>/<prefix>-<UTC yyyymmddThhmmssZ>.dump`.
- **The password stays out of the process list:** the URL is split into libpq variables (`PGHOST`, `PGPASSWORD`, …)
  for `pg_dump`, and other `PG*` variables of the shell are not passed on. A URL query parameter without a libpq
  variable is refused by name.
- The dump is written with mode `0600` through a temporary file and a rename; a failed `pg_dump` leaves no file.
- **Integrity:** the new file must start with the custom format's `PGDMP` header; otherwise it is removed and the
  step fails, before any retention.
- **Retention** runs only after a dump succeeded: the newest `--keep` dumps of `--prefix` stay, older ones of that
  prefix are removed and named in the output. With `--max-age-days=<n>` a dump whose name stamp is older than `n`
  days is removed too (one exactly `n` days old stays): a limit a privacy policy can promise ("deleted data leaves
  the backups within 30 days"). The newest dump is never removed. Other files in the folder are never touched.
- **Excluded rows:** `--exclude-table-data=auth_attempts,audit.ip_log` keeps those tables' definitions and drops
  their rows from the dump, for data that must not outlive its own retention (IP addresses of login attempts).
- `pg_dump` must be at least the server's major version; `--pg-dump=<path>` picks another binary
  (`/usr/lib/postgresql/16/bin/pg_dump`).

### `softure-deploy schema-guard`

```bash
softure-deploy schema-guard --migrations-dir=<dir> [--url-env=DATABASE_URL]
```

Compares the new image's migrations (the folder `softure migrate --export-migrations <dir>` wrote in the build
stage) with the database's `@softure-ai/db` ledger `softure.migrations`, using the migrator's own rules
(`checkExportedMigrations`). It refuses, with one line per problem:

- an applied migration whose file in the image has another checksum (edited after it ran);
- an applied migration the image does not have (an older image, or an older `@softure-ai/db` for the ledger's own
  migrations): deploying it would run code against a schema it does not know;
- a new file numbered below one already applied (it would never run).

Otherwise it prints the files the deploy will apply, and the ledger modules the image does not hold (not enabled
there; the migrator leaves them alone). It takes no lock and writes nothing.

**Where it runs:** wherever the folder and the database are both reachable. In the new image before the switch is the
simplest (`docker compose run --rm --no-deps app npx softure-deploy schema-guard …`; the image holds the folder and
joins the compose network). On the host it works after `docker cp` of the folder out of the new image.

### `softure-deploy row-counts`

```bash
softure-deploy row-counts [--tables=<a,b.c> | --config=deploy.json] [--out=<file>] [--compare=<file>] [--url-env=DATABASE_URL]
```

```json
{ "database": { "rowCountTables": ["users", "snapshots", "position_values"] } }
```

- Counts the rows of each table (`table` or `schema.table`, lower snake case; the app's key tables, like FIRE's
  `users`, `snapshots`, `position_values`) and prints one line per table.
- **Which tables:** `--tables`, or else `database.rowCountTables` of `deploy.json` (`--config` names another file),
  so the list lives with the app's other deploy settings. With `--tables` the file is not read; passing both flags is
  a usage error, and so is having neither the flag nor the list (exit `2`). An invalid file is exit `1` with its issues.
- `--out` saves the counts as JSON (`{ "takenAt", "counts" }`); `--compare` reads such a file and prints
  `before -> after (delta)`. A table with fewer rows than before, or not counted before, fails the step (exit 1); the
  deploy script decides whether that rolls the deploy back. `count(*)` reads every row: keep the list to the tables
  whose loss would matter.

## `softure-deploy verify`

Checks a deployed app against the routes in its `deploy.json`, prints a table and exits `1` when a check fails.

```bash
softure-deploy verify <url> [--config=deploy.json] [--timeout=<ms>] [--concurrency=4]
```

```json
{
  "$schema": "https://unpkg.com/@softure-ai/deploy/schema/deploy.schema.json",
  "verify": {
    "headers": { "strict-transport-security": "max-age=", "x-powered-by": null },
    "tlsMinDays": 14,
    "routes": [
      { "path": "/", "contains": ["<h1"], "excludes": ["Application error"] },
      { "path": "/pricing", "headers": { "content-type": "text/html" } },
      { "path": "/old-pricing", "status": 308, "redirect": "/pricing" },
      { "path": "/robots.txt", "contains": ["Sitemap:"] }
    ]
  }
}
```

- **A route** is a `path` (on `<url>`, which may carry a path prefix) with an expected `status` (default 200),
  `contains` and `excludes` body markers, a `redirect` target (a path or an absolute URL; needs a 3xx status) and
  `headers`.
- **The request:** `method` (default `GET`; also `HEAD`, `POST`, `PUT`, `PATCH`, `DELETE`, `OPTIONS`), `body` (not
  with `GET` or `HEAD`) and `requestHeaders`, sent on top of verify's own: an unauthenticated `POST` that must answer
  401, a bot's `user-agent` that must get the page and not a CDN challenge, `accept: text/markdown`. `host`,
  `content-length`, `connection` and `transfer-encoding` are refused. A non-GET route runs on every verify, so make
  it one the app treats as a no-op or a check. The report names its method (`POST /api/mcp`).
- **Type, not only status:** a `content-type` header check (`"headers": { "content-type": "application/rss+xml" }`)
  catches a login page served with 200 where a feed or an image belongs.
- **One host per run:** an app on two hosts (apex and `app.` subdomain) runs `verify` once per host, each with its
  own config.
- **Headers:** a value is text the header must contain, case-insensitive; `null` means the header must be absent.
  `verify.headers` applies to every route; a route's entry for the same name wins.
- **Requests:** `GET` with `cache-control: no-cache`, redirects not followed, at most `--concurrency` at once
  (default 4), each within `verify.timeoutMs` (default 10000) or `--timeout`. A TLS, connection or timeout error
  fails that route with the reason; other routes still run.
- **Certificate:** with `verify.tlsMinDays` (1 to 365), `verify` opens one TLS connection to the URL's host, reads
  the certificate without sending a request and adds a `tls` row: days left, the expiry date (UTC) and the issuer.
  Fewer days than the minimum, a certificate not trusted for the host, a handshake error or an `http://` URL fail
  the row and the run. Behind Cloudflare the certificate seen is Cloudflare's edge one, which it renews itself; the
  check matters for an origin served directly (Traefik with ACME).
- The schema is in [`schema/deploy.schema.json`](schema/deploy.schema.json) (`npm run schema -w @softure-ai/deploy`
  after changing `src/verify/schema.ts`). The route list is the app's; the package holds only the engine.
- The same file holds `database.rowCountTables`, the tables `row-counts` compares (see above).

```text
Result  Status  Route     Detail
PASS    200     /         5 checks passed
FAIL    404     /pricing  status 404, expected 200; missing "Pricing"
PASS    -       tls       41 days left (until 2026-11-16), issuer Let's Encrypt

verify: 2 routes at https://example.com, 1 passed, 1 failed; certificate passed
```

## Deploy workflow

`SOFTURE/AI/.github/workflows/deploy-app.yml` is a reusable workflow that releases one app to its VPS. The app keeps
one caller, [`examples/deploy.yml`](examples/deploy.yml), with a single `uses:` line. For the release tag it:

1. checks every input (tag, URL, paths, image, command word, port, timeout) before anything runs;
2. builds the image from the tag and pushes `<image>:<tag>` to GHCR (the only job with `packages: write`);
3. renders `.env.prod` with `softure-deploy env render` from the `app-secrets` JSON and sends it on stdin to the
   server's forced SSH command as `<remote-command> <tag>`, checking the host key against `ssh-known-hosts`;
4. waits until `<app-url><health-path>` answers 200, then runs `softure-deploy verify <app-url>` with the app's
   `deploy-config` read from the tag (only that file is checked out). A missing or invalid file fails the run;
   `deploy-config: ""` keeps the health route only.

| Input | Default | |
| --- | --- | --- |
| `tag` | required | release tag: the git ref built and the image tag |
| `app-url` | required | public base URL, `https://<host>[:port]` |
| `image` | `ghcr.io/<owner>/<repository>` | image name without a tag |
| `context`, `dockerfile` | `.`, `Dockerfile` | the build |
| `compose-file` | `docker/prod/docker-compose.yml` | names the secrets to render |
| `environment` | none | GitHub environment of the deploy job |
| `remote-command` | `deploy` | first word for the forced command |
| `ssh-port` | `22` | |
| `health-path`, `verify-timeout-seconds` | `/api/health`, `300` | the health wait before verify |
| `deploy-config` | `deploy.json` | the routes `verify` checks; empty for the health route only |
| `deploy-cli-version` | this package's version | the CLI run from npm (`env render`, `verify`) |

Secrets, all required and passed by name (no `secrets: inherit`): `ssh-host`, `ssh-user`, `ssh-private-key`,
`ssh-known-hosts` and `app-secrets` (a JSON object such as `toJSON(secrets)`; names like `PATH`, `HOME`, `NODE_*` and
`NPM_CONFIG_*` are refused). The workflow runs once this package is on npm; callers pin the `deploy-workflows-v1` tag
the owner sets, or its commit SHA.

## `softure-deploy init`

Writes the files that describe one app's deploy, once. The app owns them afterwards: an existing file is kept and
named in the output, and only `--force` overwrites it.

```bash
softure-deploy init --domain=example.com --image=ghcr.io/acme/app [--dir=.] [--name=<slug>] [--paths=/] [--www] \
  [--acme-email=<email>] [--env=AUTH_SECRET,...] [--tables=users,billing.subscriptions] [--force]
```

| File | What it holds |
| --- | --- |
| `Dockerfile` | the `@softure-ai/ops` container recipe: a Next standalone build, a non-root user, `HEALTHCHECK` in the image and, with a database, `migrate.mjs` and the exported migrations |
| `.dockerignore` | local state and secrets out of the build context |
| `docker/prod/docker-compose.yml` | Traefik and the app; with a database also Postgres (port on `127.0.0.1` only) and the one-off `migrate` service the app waits for |
| `docker/prod/traefik.yml` | the apex router (`Host` and, unless `--paths=/`, `/`, `/_next/`, the health route and the given prefixes), security headers, the optional `www` redirect |
| `docker/prod/initdb/01-roles.sql` | with a database: the migrator and app roles of the ops recipe |
| `docker/server/deploy.sh` | the server's forced command for `deploy-app.yml` (below) |
| `scripts/migrate.ts` | with a database: the migrate step the `Dockerfile` bundles |
| `.github/workflows/deploy.yml` | the caller of `deploy-app.yml` with the domain, the image and the health path |
| `deploy.json` | a `verify` starter: `/` without an error page, `/api/health` when the app has one, HSTS present, `x-powered-by` absent |

- **Asked:** `--domain` and `--image`; `--paths`, `--www`, `--acme-email`, `--env` (the app's own secrets, added to
  the app service in the required form so `env render` renders them), `--tables` (what `row-counts` compares) and
  `--name` (compose project, server folder `/srv/<name>`, database name; default from `package.json`).
- **Read from the app:** `@softure-ai/db` in `package.json` turns on the database part, `@softure-ai/ops` the
  `/api/health` route (else `/`), a `public/` folder its `COPY`; a `next.config.*` without `standalone` is a warning.
  Nothing is read from `softure.config`.
- **Values are narrow:** the domain, image, name, paths, e-mail, env names and tables are checked against patterns
  before anything is written, so no value can break out of YAML, bash or a Traefik rule.
- **Secrets:** the compose file's required variables are the list the workflow renders: `POSTGRES_PASSWORD`,
  `SOFTURE_MIGRATOR_PASSWORD`, `SOFTURE_APP_PASSWORD` with a database, plus `--env`. Use URL-safe passwords
  (`openssl rand -hex 32`): they go into connection URLs as they are.

**`deploy.sh` on the server.** Copy `docker/prod/*` and `docker/server/deploy.sh` to `/srv/<name>/` and bind the
deploy key to the script in `authorized_keys` (`command="/srv/<name>/deploy.sh",restrict …`). For
`SSH_ORIGINAL_COMMAND="deploy <tag>"` and `.env.prod` on stdin it:

1. refuses anything but `deploy <tag>` with a Docker tag, writes `.env.prod` with mode 0600 and pulls the image;
2. with a database: starts Postgres, runs `backup`, copies the migrations out of the new image for `schema-guard`,
   and saves `row-counts` (all through `npx @softure-ai/deploy@<this version>` on the host, against `127.0.0.1`);
3. `docker compose up -d --wait` (the migrate service runs before the app);
4. with a database: `row-counts --compare`;
5. records the tag in `.deployed-tag`. A failed step stops the release and prints the previous tag to redeploy.

The host needs Docker with the compose plugin logged in to the registry, and with a database Node.js 22 and
`pg_dump` of the compose file's Postgres major version. CI generates the files for the example app, staged as a
standalone app, and builds its image from the generated `Dockerfile` (`npm run e2e:deploy-init`).

## Library

The same steps as functions, for scripts that need them without the CLI:
`findComposeNames`, `findRequiredNames`, `renderEnvFile` (a result value: the text, or the missing and unsafe names),
`readReleaseCommits`, `findPreviousTag`, `toReleaseEntries`, `formatReleaseNotes`, `parseRoadmapItems`,
`selectShippingItems`, `writeReleaseSection`, `readReleaseSection`, `toLibpqEnv`, `createBackup`,
`selectExpiredBackups`, `selectAgedBackups`, `hasCustomFormatHeader`, `guardSchema`, `parseTableList`, `countRows`, `compareRowCounts`, `parseDeployConfig`,
`runVerify` (an injectable `fetch`), `checkResponse`, `formatVerifyReport`, `parseInitAnswers`, `readAppFacts`,
`planInitFiles` (pure: the files and their text), `writeInitFiles`.

## Parity with FIRE_TRACKER

FIRE_TRACKER's release scripts were read side by side with this package on 2026-10-06 (DF-1; the full comparison is
in [`context/archive/2026-10-06-deploy-fire-parity/research.md`](../../context/archive/2026-10-06-deploy-fire-parity/research.md)).

**In the package:** optional compose names and the header line (`env render`); the release body section and the
roadmap table (`release-notes`); excluded table data, the age limit and the header check (`backup`); method, body and
request headers (`verify`). Already here before: names from the compose file, values never printed, mode 0600, the
schema guard (stricter than FIRE's migration count), row counts, status, markers, redirects, header and type checks,
certificate expiry.

**Tracked as roadmap items** (they change `deploy-app.yml` or `init`'s `deploy.sh`, which DF-7 changes now):

- **DF-9:** the server script's read-only `status` command, file and `.env.prod` restore on a failed switch,
  `.env.prod.prev`, a Traefik recreate when `traefik.yml` changed, the tag in `.env.prod`, a daily cron for backup age
  and image pruning, machine-readable step lines.
- **DF-10:** a report job writes pipeline status and deployment history (image, digest, backup, row counts before and
  after) into the release body.
- **DF-11:** the tag must be on the default branch; build arguments, with a check that the origin baked into the
  image equals the runtime one; non-secret values for optional names; a registry token per deploy instead of a
  permanent login on the server.
- **DF-12:** a reusable workflow that cuts a date tag and release and starts the deploy (an agent cannot push tags).
- **DF-13:** `verify` checks that the server's IP refuses direct HTTPS (only the CDN may reach it).

**Kept different on purpose:** the custom dump format instead of plain SQL with gzip (compressed, restorable table by
table); `row-counts` fails on a drop, not on any change (a sign-up during a release is not a failure); seven dumps
by default instead of ten (`--keep`).

**Stays in the app:** FIRE's tag pattern `vYYYY.MM.DD[-N]`, its gates and integration suite inside the release run,
the 32-character check of `WAITLIST_UNSUBSCRIBE_SECRET`, `release-opis.yml` (it replaces the text above the report,
which `--body` keeps), the dry run of `konta-wyslij`, the blog sync and the app's own cron lines, the skill digest
check, markers inside `<head>`, the IndexNow key and a 404 that only warns.

## Exit codes

`0` done · `1` the command refused (missing names, unknown ref, unreadable or invalid file, a failed dump, a guard
problem, lost rows, a failed verify check, invalid init answers) · `2` a wrong command line.

## Limitations

- Release notes read only git: no labels, authors or pull request bodies (no GitHub API). FIRE's report does not
  group by label either.
- `backup` writes to a local folder only; copying dumps off the server is the server's job.
- `verify` does not wait for the app to come up; the deploy workflow's health step does.
- `init` files reach the server by hand: the workflow sends only `.env.prod`, so a changed compose file, Traefik rule
  or `deploy.sh` is copied again before the next release (DF-7).
- `init` writes one app per VPS, with Traefik in the app's compose file.
