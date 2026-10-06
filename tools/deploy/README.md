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
- A listed table the database lacks prints `absent` and is not an error, so a table can join the list in the
  release whose migration creates it.
- `--out` saves the counts as JSON (`{ "takenAt", "counts" }`, an absent table as `null`); `--compare` reads such a
  file and prints `before -> after (delta)`, or `absent -> <n> (created by this release)` for a table absent before.
  A table with fewer rows than before, not counted before, or absent now (`<n> -> absent`, also `absent -> absent`
  for a misspelled name) fails the step (exit 1); the deploy script decides whether that rolls the deploy back. `count(*)` reads every row: keep the list to the tables
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
3. renders `.env.prod` with `softure-deploy env render` from the `app-secrets` JSON, packs it with the tag's server
   files (the compose file's folder, `server-script` as `deploy.sh`, `deploy-config` as `deploy.json`) into one gzip
   tar and sends that on stdin to the server's forced SSH command as `<remote-command> <tag>`, checking the host key
   against `ssh-known-hosts`. A symlink in the compose folder, or a file there named like one the server keeps
   (`.env.prod`, `.env.prod.prev`, `deploy.sh`, `deploy.json`, `.deployed-tag`, `.deploy.lock`, `backups`,
   `releases`), stops the run. The step fails unless the server's output holds the line `result|ok` (below), so a
   session cut halfway never reads as a release; the output stays in `$RUNNER_TEMP/deploy-output.txt` for the job;
4. waits until `<app-url><health-path>` answers 200, then runs `softure-deploy verify <app-url>` with the app's
   `deploy-config` read from the tag (only that file is checked out). A missing or invalid file fails the run;
   `deploy-config: ""` keeps the health route only.

| Input | Default | |
| --- | --- | --- |
| `tag` | required | release tag: the git ref built and the image tag |
| `app-url` | required | public base URL, `https://<host>[:port]` |
| `image` | `ghcr.io/<owner>/<repository>` | image name without a tag |
| `context`, `dockerfile` | `.`, `Dockerfile` | the build |
| `compose-file` | `docker/prod/docker-compose.yml` | names the secrets to render; its folder ships to the server |
| `server-script` | `docker/server/deploy.sh` | the forced command, installed on the server as `deploy.sh` with each release |
| `environment` | none | GitHub environment of the deploy job |
| `remote-command` | `deploy` | first word for the forced command |
| `ssh-port` | `22` | |
| `health-path`, `verify-timeout-seconds` | `/api/health`, `300` | the health wait before verify |
| `deploy-config` | `deploy.json` | the routes `verify` checks, also shipped to the server; empty for the health route only |
| `deploy-cli-version` | this package's version | the CLI run from npm (`env render`, `verify`) |
| `e2e` | `false` | this repository's own end-to-end test (below); refused in any other repository |

Secrets, all required and passed by name (no `secrets: inherit`): `ssh-host`, `ssh-user`, `ssh-private-key`,
`ssh-known-hosts` and `app-secrets` (a JSON object such as `toJSON(secrets)`; names like `PATH`, `HOME`, `NODE_*` and
`NPM_CONFIG_*` are refused). The workflow runs once this package is on npm; callers pin the `deploy-workflows-v1` tag
the owner sets, or its commit SHA.

### End-to-end test

[`.github/workflows/e2e-deploy.yml`](../../.github/workflows/e2e-deploy.yml) calls `deploy-app.yml` from the same
commit with `e2e: true` for the example app, on every pull request that touches the workflow or `tools/deploy/`, on
`master` and on demand. On that path:

- `build` builds the example app's image (`examples/next-app/Dockerfile`) without the GHCR login and without a push;
- `deploy` builds this CLI from a full checkout of the tag instead of running the npm version, and
  [`e2e/start-server.sh`](e2e/start-server.sh) starts a throwaway `sshd` container on the runner with fresh host and
  client keys; the deploy key reaches only the forced command [`e2e/server/record.sh`](e2e/server/record.sh). The send
  step runs the production `ssh` command (host key checked) against it. The recorder writes the command line, the
  archive's files, their SHA-256, the mode of `.env.prod` and its names (never a value), uploaded as the artifact
  `deploy-e2e-received`;
- `verify` is skipped: the recorder does not run the app.

The caller's `assert` job runs [`e2e/check-received.sh`](e2e/check-received.sh): the image is
`ghcr.io/softure/ai-deploy-e2e:<sha>`, the command line `deploy <sha>`, the files are byte for byte the tag's, and
`.env.prod` (0600) holds exactly the compose file's required names, not the extra secret the caller also passes.
The server files are `init`'s output for the example app, committed under [`e2e/app/`](e2e/app/); after a template
change, `npm run e2e-app -w @softure-ai/deploy` rewrites them (`tests/e2e-scripts.test.ts` fails until then). `check`
refuses `e2e` unless the caller is `SOFTURE/AI`, so an app can never take this path.

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
| `deploy.json` | a `verify` starter: `/` without an error page, `/api/health` when the app has one, HSTS present, `x-powered-by` absent; with a database and `--tables`, `database.rowCountTables` |

- **Asked:** `--domain` and `--image`; `--paths`, `--www`, `--acme-email`, `--env` (the app's own secrets, added to
  the app service in the required form so `env render` renders them), `--tables` (what `row-counts` compares on
  the server, written into `deploy.json`; with a `deploy.json` that `init` keeps, add `database.rowCountTables` to it
  by hand) and `--name` (compose project, server folder `/srv/<name>`, database name; default from `package.json`).
- **Read from the app:** `@softure-ai/db` in `package.json` turns on the database part, `@softure-ai/ops` the
  `/api/health` route (else `/`), a `public/` folder its `COPY`; a `next.config.*` without `standalone` is a warning.
  Nothing is read from `softure.config`.
- **Values are narrow:** the domain, image, name, paths, e-mail, env names and tables are checked against patterns
  before anything is written, so no value can break out of YAML, bash or a Traefik rule.
- **Secrets:** the compose file's required variables are the list the workflow renders: `POSTGRES_PASSWORD`,
  `SOFTURE_MIGRATOR_PASSWORD`, `SOFTURE_APP_PASSWORD` with a database, plus `--env`. Use URL-safe passwords
  (`openssl rand -hex 32`): they go into connection URLs as they are.

**`deploy.sh` on the server.** Once, by hand: copy `docker/server/deploy.sh` to `/srv/<name>/` (a folder the SSH
user owns) and bind the deploy key to it in `authorized_keys` (`command="/srv/<name>/deploy.sh",restrict …`). Every
release then brings the rest. It answers three commands in `SSH_ORIGINAL_COMMAND` (anything else, or more than one
line, exits 2):

- **`status`**, read only (no lock, nothing written): `status|tag|<tag in .deployed-tag>`, `status|env-tag|<TAG in
  .env.prod>`, `status|containers|<service:status …>` and `status|health|<the app container's health>`, each `none`
  when there is nothing yet. For the owner: `ssh -i <deploy key> <user>@<host> status`.
- **`deploy <tag>`** with the release archive on stdin:
  1. refuses anything but a Docker tag; reads at most 16 MiB, refuses an archive with anything but files and folders,
     a path outside it or a name the server keeps (`.env.prod.prev`, `.deployed-tag`, `.deploy.lock`, `backups`,
     `releases`), unpacks it into `releases/<tag>/` (the newest 5 are kept) and checks the compose file with
     `docker compose config`;
  2. saves every installed file the release is about to replace, then moves `.env.prod` into place (0600) with
     `TAG=<tag>` in it (so a `docker compose` by hand or from the cron runs the live release), copies the other files
     next to itself (in place, so Traefik's bind-mounted rules keep their inode; files 0644, folders 0755), replaces
     itself by a rename (the new copy runs from the next release) and pulls the image;
  3. with a database: starts Postgres, runs `backup` (`--keep=7 --max-age-days=30`), copies the migrations out of the
     new image for `schema-guard`, and saves `row-counts` (all through `npx @softure-ai/deploy@<this version>` on the
     host, against `127.0.0.1`) for `database.rowCountTables` of the `deploy.json` this release shipped
     (`releases/<tag>/deploy.json`); without that file or key, and on the first release, the counts are skipped. The
     count before the switch runs against the old schema, so a table the release's own migration creates is
     counted as absent and may join the list in that release;
  4. keeps the replaced `.env.prod` as `.env.prod.prev` (0600) and switches: `docker compose up -d --wait` (the
     migrate service runs before the app); recreates Traefik when its rules changed (a running Traefik holds the
     rules it started with);
  5. with a database: `row-counts --compare`;
  6. records the tag in `.deployed-tag` and writes its crontab line (below).
- **`maintain`**, the daily cron's command: with a database a `backup` with the same retention, so no dump outlives
  30 days between releases either; then removes this app's image tags whose release folder is gone (the newest 5
  stay for a quick rollback; Docker refuses one a container uses) and the host's dangling images.

**Restore.** A step that fails before the switch puts the saved files and `.env.prod` back (the rules by copying onto
the installed file, the script by a rename) and removes files and folders the release added; containers it already
started stay (a changed `postgres` service starts at step 3). From the switch on nothing is put back: the migrations
may have run, and old files over a new schema are worse than a stopped release. A rollback is a redeploy of the
previous tag, which the failure message names.

**Output.** One line per finished step on stdout, `step|<name>|ok[|<detail>]` (`archive`, `files`, `pull`,
`postgres`, `backup`, `schema`, `row-counts-before`, `switch`, `traefik`, `row-counts-after`, `tag`, `cron`; `restore`
after a restore; `backup`, `images` for `maintain`), and every `deploy` or `maintain` run, refused commands included,
ends with `result|ok` or `result|failed|<step>|<message>`. Messages for people start with `deploy:`.

**Cron.** Each release rewrites one line of the deploy user's crontab, marked `# softure-deploy:<name>`: `maintain`
daily at 03:17 server time, its output to syslog under `<name>-maintain` (`journalctl -t <name>-maintain`). Other
lines, other apps' marked lines included, stay. `deploy` and `maintain` never run at the same time: both take
`.deploy.lock` with `flock` and wait up to 10 minutes for it.

Shipping `deploy.sh` widens nothing: whoever holds the deploy key already picks the image and its environment, and
the deploy user runs Docker, which is root on the host.

The host needs Docker with the compose plugin logged in to the registry, `cron` and `flock` (both in Ubuntu's base
system), and with a database Node.js 22 and `pg_dump` of the compose file's Postgres major version. CI generates the files for the example app, staged as a
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

**In `init`'s `deploy.sh` (DF-9):** the read-only `status` command, the file and `.env.prod` restore when a release
fails before the switch, `.env.prod.prev`, the Traefik recreate when `traefik.yml` changed, the tag in `.env.prod`, a
daily cron for the backup age and old images, and the step and result lines the workflow checks. FIRE's gateway and
its second-stage script inside the image stay one script here: the release ships it (DF-7).

**Tracked as roadmap items** (they change `deploy-app.yml` or `init`'s `deploy.sh`):

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
- Files a release no longer ships stay on the server; remove them by hand.
- A `deploy.sh` generated by 0.1.2 or earlier reads `.env.prod`, not the release archive, and prints no `result|ok`,
  which `deploy-app.yml` requires: copy the new one to the server once by hand (or run `init --force` and copy it),
  then every release ships it.
- `init` writes one app per VPS, with Traefik in the app's compose file.
- The end-to-end test stops at the server's forced command: neither the shipped `deploy.sh` nor the `verify` job runs
  there (DF-15).
