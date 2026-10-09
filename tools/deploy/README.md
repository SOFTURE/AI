# @softure-ai/deploy

Deploy CLI for an app that runs on one VPS with Docker Compose. It holds the steps that do not change from app to
app; what describes one app (compose file, Traefik rules, Dockerfile) stays in the app
([docs/06](../../docs/06-fire-extraction-2.md), "Deploy: package or template").

```bash
npm install --save-dev @softure-ai/deploy
npx softure-deploy help
```

## `softure-deploy env render`

Writes the production env file from the environment, for every variable the compose file requires.

```bash
softure-deploy env render [--compose=docker/prod/docker-compose.yml] [--out=.env.prod] [--from-json-env=<NAME>]...
```

- **Names come from the compose file:** every `${NAME:?…}` (refuses an unset or empty value) and `${NAME?…}`
  (refuses only an unset one) is required. `${NAME:-default}` and `${NAME-default}` are optional: written when the
  environment sets them to a non-empty value, left out otherwise (the compose default applies), so a runtime switch
  such as `ADMIN_EMAILS` reaches the server without blocking a release that does not set it. A name required anywhere
  in the file is required. Bare `${NAME}` (it also names what the server script sets, like `${TAG}`) and escaped
  `$${…}` are skipped, so the compose file stays the one list of what production reads.
- **Values come from the environment** (in CI: `env:` from the repository secrets). A missing name stops the
  command with every missing name listed; nothing is written.
- **Or from JSON objects:** `--from-json-env=APP_SECRETS` reads the variable `APP_SECRETS` as a JSON object of names
  and values (`toJSON(secrets)` in a workflow) and takes the values from it alone, not from the rest of the
  environment, so a host's `PATH` or `HOME` never lands in `.env.prod`. The flag repeats; a later object wins for a
  name both hold (`--from-json-env=APP_SECRETS --from-json-env=APP_VARS` puts variables over secrets). A value that is
  not a string is skipped like an unset one. An unset variable or one that is not a JSON object stops the command by
  its name; the missing names are listed with the objects they were looked up in.
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
# Or every secret and variable of the repository, variables over secrets
- run: npx softure-deploy env render --from-json-env=APP_SECRETS --from-json-env=APP_VARS
  env:
    APP_SECRETS: ${{ toJSON(secrets) }}
    APP_VARS: ${{ toJSON(vars) }}
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

## `softure-deploy release-report`

The deploy run's report in the same release body (DF-10): the pipeline status of the latest run and the history of
every deployment of the tag.

```bash
softure-deploy release-report --body=<release body file> --summary=deploy-report.json [--locale=en|pl] [--out=<file>]
```

- **Input:** `--summary` is the `deploy-report.json` the `summary` job of `deploy-app.yml` uploads (version 1: tag,
  environment, image, digest, run URL, end time in UTC, each job's result and the server's `step|…`/`result|…`
  lines). Another shape fails with the field's name. `--body` is the release's current body; a missing file is empty.
- **Status:** between `<!-- softure-deploy:status -->` markers, `## Pipeline status`: one row per job with its result
  (✅ success, ❌ failure, ⛔ cancelled, ⏭️ skipped, ⏳ anything else) and the link to the run. Every run replaces it.
- **Deployments:** between `<!-- softure-deploy:deployments -->` markers, `## Deployments`: one row per run, the newest
  on top, the earlier rows kept byte for byte, so a rerun or a rollback adds a row. Columns: time (UTC), result
  (`deployed`, or `failed at <step>` from the server's `result|failed|<step>|…`), environment, image and digest, the
  backup file and the row counts before → after (`?` when the server stopped before counting again, `not counted` on
  a first release), the verify result and the run. A run whose deploy job was skipped writes the status only.
- **Order:** the sections stand in a fixed order whatever wrote them first: `release-notes`, status, deployments; the
  owner's text above them stays. Values from the summary are reduced to letters, digits and plain punctuation, so a
  `|`, a backtick or `<` cannot break the table.
- A GitHub Release body holds at most 125 000 characters; one row is about 300, so a tag reaches the limit after some
  300 runs, and the report's `gh release edit` then fails without touching the deploy.

## Database steps around a deploy

`backup`, `schema-guard` and `row-counts` read the database URL from `DATABASE_URL` (`--url-env=<NAME>` names
another variable). The URL is never printed; a driver error prints its message only. A server `deploy.sh` runs them
in this order:

```bash
softure-deploy backup --dir=/srv/app/backups --keep=7                   # 1. dump, then retention
docker compose run --rm --no-deps app \
  npx softure-deploy schema-guard --migrations-dir=/app/softure-migrations   # 2. in the NEW image, before the switch
softure-deploy row-counts --tables=users,billing.subscriptions --out=counts-before.json   # 3.
docker compose up -d app && docker compose run --rm app node migrate.js  # 4. switch and migrate (the app's own)
softure-deploy row-counts --tables=users,billing.subscriptions --compare=counts-before.json  # 5.
```

**Without a connection (`--stdin`).** When the database publishes no port (Postgres reachable only on the compose
network), the CLI never connects: `pg_dump` and `psql` run in the database's own container and the CLI reads their
output. `schema-guard` and `row-counts` print the one statement they need with `--print-query`; `psql -At` runs it and
the JSON line it prints goes back on stdin. `init`'s `deploy.sh` does this with `database.access: "compose-exec"`.

```bash
exec_db() { docker compose exec -T postgres "$@"; }
exec_db pg_dump --format=custom -U postgres app | softure-deploy backup --stdin --dir=backups --keep=7
exec_db psql -At -U postgres app -c "$(softure-deploy schema-guard --print-query --app-ledger=drizzle.__drizzle_migrations)" \
  | softure-deploy schema-guard --stdin --migrations-dir=migrations --app-journal=journal.json
exec_db psql -At -U postgres app -c "$(softure-deploy row-counts --print-query --tables=users)" \
  | softure-deploy row-counts --stdin --tables=users --out=counts-before.json
```

### `softure-deploy backup`

```bash
softure-deploy backup [--dir=backups] [--prefix=db] [--keep=7] [--max-age-days=<n>] [--exclude-table-data=<a,b.c>]
                      [--url-env=DATABASE_URL] [--pg-dump=pg_dump] | [--stdin]
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
- **`--stdin`:** keeps a custom-format dump `pg_dump` wrote elsewhere (in the database's container) instead of running
  one: the same file name, mode, header check and retention. The dump's own flags belong to that `pg_dump`, so
  `--url-env`, `--pg-dump` and `--exclude-table-data` with `--stdin` are a usage error.

### `softure-deploy schema-guard`

```bash
softure-deploy schema-guard --migrations-dir=<dir> [--app-journal=<file> [--app-ledger=drizzle.__drizzle_migrations]]
                            [--url-env=DATABASE_URL | --stdin]
softure-deploy schema-guard --print-query [--app-ledger=<schema.table>]
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

**The app's own migrations.** An app that also migrates with its own tool (drizzle) passes the image's journal:
`--app-journal=<file>` (drizzle's `meta/_journal.json`, copied out of the new image) is compared with the app ledger
(`--app-ledger`, drizzle's `drizzle.__drizzle_migrations` by default). When the database ran more migrations than the
journal lists, the image is older than the schema and the guard refuses it
(`drizzle.__drizzle_migrations: the image knows 41 migration(s), the database ran 42; …`); otherwise it prints both
numbers. A ledger table that does not exist yet counts as no migration run. `--app-ledger` without `--app-journal` is
a usage error.

**`--stdin`:** reads the ledgers from the JSON line `psql -At` printed for the statement of
`schema-guard --print-query` (with the same `--app-ledger` when the app journal is checked) instead of connecting.
The statement reads both ledgers in one query and copes with a database where either table is still absent.

**Where it runs:** wherever the folder and the database are both reachable. In the new image before the switch is the
simplest (`docker compose run --rm --no-deps app npx softure-deploy schema-guard …`; the image holds the folder and
joins the compose network). On the host it works after `docker cp` of the folder out of the new image.

### `softure-deploy row-counts`

```bash
softure-deploy row-counts [--tables=<a,b.c> | --config=deploy.json] [--out=<file>] [--compare=<file>]
                          [--url-env=DATABASE_URL | --stdin]
softure-deploy row-counts --print-query [--tables=<a,b.c> | --config=deploy.json]
```

```json
{ "database": { "rowCountTables": ["users", "orders", "invoices"] } }
```

- Counts the rows of each table (`table` or `schema.table`, lower snake case; the app's key tables, like
  `users`, `orders`, `invoices`) and prints one line per table.
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
- **`--stdin`:** reads the counts from the JSON line `psql -At` printed for the statement of `row-counts
  --print-query` with the same tables, instead of connecting; a snapshot that counts other tables is refused.

## `softure-deploy verify`

Checks a deployed app against the routes in its `deploy.json`, prints a table and exits `1` when a check fails.

```bash
softure-deploy verify <url> [--config=deploy.json] [--timeout=<ms>] [--concurrency=4] [--origin=<host>[:<port>]]
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
- **Headers:** a value is text the header must contain, case-insensitive; a list of texts the value must all
  contain (`"link": ["rel=\"api-catalog\"", "rel=\"service-desc\""]`, `"cache-control": ["private", "no-store"]`),
  each reported as its own check in the route's row; `null` means the header must be absent. `verify.headers`
  applies to every route; a route's entry for the same name wins, the whole list with it.
- **Requests:** `GET` with `cache-control: no-cache`, redirects not followed, at most `--concurrency` at once
  (default 4), each within `verify.timeoutMs` (default 10000) or `--timeout`. A TLS, connection or timeout error
  fails that route with the reason; other routes still run.
- **Certificate:** with `verify.tlsMinDays` (1 to 365), `verify` opens one TLS connection to the URL's host, reads
  the certificate without sending a request and adds a `tls` row: days left, the expiry date (UTC) and the issuer.
  Fewer days than the minimum, a certificate not trusted for the host, a handshake error or an `http://` URL fail
  the row and the run. Behind Cloudflare the certificate seen is Cloudflare's edge one, which it renews itself; the
  check matters for an origin served directly (Traefik with ACME).
- **Origin behind a CDN:** with `--origin=<address>` (the server's own IP, port 443 unless given; `[v6]:port` for
  IPv6), `verify` opens one TCP connection to it, sends nothing, and adds an `origin` row. The row passes only when
  nothing answers: the connection times out (a firewall dropping it), is refused or cannot be routed. An accepted
  connection fails the row and the run, because direct HTTPS reaches the server around the CDN. An address that does
  not resolve fails too (nothing was checked). It is a TCP handshake, not an HTTPS request: an open origin whose
  certificate does not cover the IP still fails. The address is a command-line value, never in `deploy.json`, so it
  stays out of the repository. Pass the server's IP, not a name that resolves through the CDN.
- The schema is in [`schema/deploy.schema.json`](schema/deploy.schema.json) (`npm run schema -w @softure-ai/deploy`
  after changing `src/verify/schema.ts`). The route list is the app's; the package holds only the engine.
- The same file holds `database.rowCountTables`, the tables `row-counts` compares (see above).

```text
Result  Status  Route     Detail
PASS    200     /         5 checks passed
FAIL    404     /pricing  status 404, expected 200; missing "Pricing"
PASS    -       tls       41 days left (until 2026-11-16), issuer Let's Encrypt
PASS    -       origin    203.0.113.7:443 no answer within 10000 ms (dropped)

verify: 2 routes at https://example.com, 1 passed, 1 failed; certificate passed; origin passed
```

## Deploy workflow

`SOFTURE/AI/.github/workflows/deploy-app.yml` is a reusable workflow that releases one app to its VPS. The app keeps
one caller, [`examples/deploy.yml`](examples/deploy.yml), with a single `uses:` line. For the release tag it:

1. checks every input (tag, URL, paths, image, command word, port, timeout, release branch, build arguments) before
   anything runs, then refuses a tag whose commit is not on the release branch (`release-branch`, else the caller's
   default branch; commits only are fetched for it);
2. builds the image from the tag with `build-args` and pushes `<image>:<tag>` to GHCR (the only job with
   `packages: write`); with `prebuilt-image`, builds nothing and adds the tag to that image instead (below);
3. renders `.env.prod` with `softure-deploy env render` from the `app-secrets` JSON and the `app-vars` JSON over it,
   and stops when a build argument's name is in `.env.prod` with another value (the image and the runtime would
   disagree, and every write broke in an adopting app; only the name is printed). It packs `.env.prod` with the tag's server files (the
   compose file's folder, `server-script` as `deploy.sh`, `deploy-config` as `deploy.json`) and the job's own
   `GITHUB_TOKEN` as `.registry-token` into one gzip tar and sends that on stdin to the server's forced SSH command
   as `<remote-command> <tag>`, checking the host key against `ssh-known-hosts`. A symlink in the compose folder, or
   a file there named like one the server keeps (`.env.prod`, `.env.prod.prev`, `.registry-token`, `deploy.sh`,
   `deploy.json`, `.deployed-tag`, `.deploy.lock`, `backups`, `releases`), stops the run. The step fails unless the
   server's output holds the line `result|ok` (below), so a session cut halfway never reads as a release; the output
   stays in `$RUNNER_TEMP/deploy-output.txt` for the job;
4. waits until `<app-url><health-path>` answers 200, then runs `softure-deploy verify <app-url>` with the app's
   `deploy-config` read from the tag (only that file is checked out). A missing or invalid file fails the run;
   `deploy-config: ""` keeps the health route only. With the `origin-address` secret or `origin-address-var`, verify gets `--origin` too.
5. whatever happened, uploads the run's facts as the artifact `deploy-report` (`summary` job, no permissions): each
   job's result, the image and its digest, and the server's `step|…`/`result|…` lines (`init`'s `deploy.sh` puts the
   backup's file name and the row counts on them).

| Input | Default | |
| --- | --- | --- |
| `tag` | required | release tag: the git ref built and the image tag |
| `app-url` | required | public base URL, `https://<host>[:port]` |
| `image` | `ghcr.io/<owner>/<repository>` | image name without a tag |
| `prebuilt-image` | none | an image already built and tested, `<image>@sha256:<64 hex>` in the `image` repository: not rebuilt, only tagged |
| `context`, `dockerfile` | `.`, `Dockerfile` | the build |
| `compose-file` | `docker/prod/docker-compose.yml` | names the secrets to render; its folder ships to the server |
| `server-script` | `docker/server/deploy.sh` | the forced command, installed on the server as `deploy.sh` with each release |
| `environment` | none | GitHub environment of the deploy job |
| `secrets-from-environment` | `false` | the deploy job reads the app's secrets and the SSH values from `environment` (below); needs `environment` and `secrets: inherit` |
| `ssh-host-secret`, `ssh-user-secret`, `ssh-private-key-secret`, `ssh-known-hosts-secret` | `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_SSH_KNOWN_HOSTS` | with `secrets-from-environment`, the secrets holding the SSH values |
| `origin-address-var` | none | the `app-vars` entry holding the origin address, instead of the `origin-address` secret (below) |
| `remote-command` | `deploy` | first word for the forced command |
| `ssh-port` | `22` | |
| `health-path`, `verify-timeout-seconds` | `/api/health`, `300` | the health wait before verify |
| `deploy-config` | `deploy.json` | the routes `verify` checks, also shipped to the server; empty for the health route only |
| `deploy-cli-version` | this package's version | the CLI run from npm (`env render`, `verify`) |
| `release-branch` | the caller's default branch | the branch the tag's commit must be on |
| `build-args` | none | `NAME=value` lines baked into the image; public values only (they stay in the image's history) |
| `app-vars` | `{}` | JSON object of non-secret values, e.g. `toJSON(vars)`; rendered like secrets and over a secret of the same name, and not masked in logs (a secret `1` masks every `1`) |
| `registry-token` | `true` | send the deploy job's `GITHUB_TOKEN` (`packages: read`, valid until the job ends) for the server's pull |
| `e2e` | `false` | this repository's own end-to-end test (below); refused in any other repository |

Secrets, passed by name: `ssh-host`, `ssh-user`, `ssh-private-key`, `ssh-known-hosts` and `app-secrets` (a JSON
object such as `toJSON(secrets)`; names like `PATH`, `HOME`, `NODE_*` and `NPM_CONFIG_*` are refused, in `app-vars`
too) are required unless `secrets-from-environment` is on; the check job names a missing one before anything is built
(none is `required: true` in the workflow, since a caller with `secrets: inherit` cannot pass them). `origin-address`
is optional: the server's own address behind the CDN (the example passes `secrets.DEPLOY_ORIGIN_IP`), refused when
`deploy-config` is empty, and verify fails when it accepts a direct connection. A secret, not an input, so the address
is masked in the logs. `origin-address-var` names an `app-vars` entry with the address instead (e.g.
`DEPLOY_ORIGIN_IP` from `toJSON(vars)`, not masked); the check job refuses it next to the secret, or when `app-vars`
holds no text under that name. The registry token pulls a package
the build job of the same repository pushed (its `org.opencontainers.image.source` label links it); for an image
elsewhere, set `registry-token: false` and log the server in.

**Secrets kept in an environment (`secrets-from-environment`).** A caller's `secrets:` are evaluated in the caller's
job, which cannot name an environment, so they hold repository and organization secrets only; and an environment
secret cannot be named `app-secrets` or `ssh-private-key` (letters, digits and `_` only). An app that keeps its runtime
secrets and deploy key only in an environment whose deployment policy admits release tags only (a workflow on any
branch can read repository secrets) therefore sets `secrets-from-environment: true` with `environment` and passes
`secrets: inherit` instead of named secrets. The deploy job, which runs in that environment, then renders `.env.prod`
from its whole `secrets` context (the environment's secrets over the repository's), and sends with the secrets
`ssh-host-secret`, `ssh-user-secret`, `ssh-private-key-secret` and `ssh-known-hosts-secret` name. `env render` writes
only the compose file's required names, so `github_token`, the deploy key and unrelated secrets stay out of
`.env.prod`; a name like `NODE_AUTH_TOKEN` among the secrets is left out and named, never rendered. The check job
refuses the flag without `environment` or next to a named secret; the deploy job names any SSH secret the environment
lacks before anything is rendered. The verify job runs outside the environment, so the origin address comes from
`origin-address-var` (a repository variable in `app-vars`). Only the environment's secrets reach the release this
way: `app-vars` is still evaluated in the caller's job, so the environment's variables never arrive, and a repository
variable in `app-vars` wins over an environment secret of the same name. `secrets: inherit` passes the caller's
repository and organization secrets only to a workflow in the same organization or enterprise. The example caller
shows this form, commented.

**A tested image (`prebuilt-image`).** An app whose own pipeline builds the image and runs its tests against it
passes that image by digest, so production runs the bytes the tests saw rather than a second build of the same tag.
The check job accepts only `<image>@sha256:<digest>` with the repository of `image` (a tag could move between the
tests and the release; another repository would make the server pull something else); the build job skips the
checkout and the build, adds `<image>:<tag>` to exactly that manifest with `docker buildx imagetools create` and stops
when the tag then names another digest. The server pulls the tag as before, and the report's digest is that one.
`build-args` do not apply (the image is built already; their comparison with `.env.prod` still runs), and `e2e` with
it is refused. The workflow runs once this package is on npm; callers pin the `deploy-workflows-v1` tag
the owner sets, or its commit SHA.

### Release report

[`deploy-report.yml`](../../.github/workflows/deploy-report.yml) is the caller's second job (`needs: deploy`,
`if: always()`, see [`examples/deploy.yml`](examples/deploy.yml)). It reads the `deploy-report` artifact of the same
run and the tag's GitHub Release body (`gh release view`), runs `softure-deploy release-report` and writes the body
back (`gh release edit`): the pipeline status replaced, a deployment row added on top. It is a workflow of its own
because editing a release needs `contents: write`, which the caller grants to this job only; inside `deploy-app.yml`
every job would have needed it. One report per tag runs at a time, so two runs never drop each other's row. A tag
without a release gets no report (a notice), and a failed report never turns the run red (`continue-on-error`).
Inputs: `tag` (required), `locale` (`en` or `pl`), `deploy-cli-version`, `node-version`, `e2e` (below).

### Cut a release

`SOFTURE/AI/.github/workflows/deploy-cut-release.yml` turns one *Run workflow* into a release and its deploy, so an
agent that cannot push tags (a cloud session) can start one as a `workflow_dispatch`, and the owner can from the
Actions tab. The app's second caller is `.github/workflows/release.yml`, which `init` writes (the same file as
[`examples/release.yml`](examples/release.yml), for an app that ran `init` before it did: `workflow_dispatch` with an
optional `description`, `permissions: contents: write, actions: write`). Started on the default branch, it:

1. refuses any other ref, and invalid inputs, with one `::error::` line each;
2. picks the next free tag `<tag-prefix><YYYY.MM.DD>` in `timezone`, then `-2`, `-3`, … (existing tags from the API,
   no checkout);
3. creates the GitHub Release on the dispatched commit (`github.sha`), the `description` above GitHub's generated
   notes;
4. runs `gh workflow run <deploy-workflow> --ref <tag> -f tag=<tag>`. A release created with `GITHUB_TOKEN` starts no
   other workflow, so `release: published` in `deploy.yml` does not fire and this step is what deploys. The deploy
   workflow needs a `workflow_dispatch` input `tag`, as [`examples/deploy.yml`](examples/deploy.yml) has.

| Input | Default | |
| --- | --- | --- |
| `description` | empty | markdown above the generated release notes |
| `tag-prefix` | `v` | text before the date |
| `timezone` | `UTC` | IANA zone whose date names the tag (`Europe/Warsaw` for a Polish day) |
| `deploy-workflow` | `deploy.yml` | the deploy caller started on the tag; empty cuts the release only |

Outputs: `tag`, `sha`. One run per repository at a time (`concurrency`, not cancelled). Semver tags are out of its
scope: packages keep their own release workflow.

### End-to-end test

[`.github/workflows/e2e-deploy.yml`](../../.github/workflows/e2e-deploy.yml) calls `deploy-app.yml` from the same
commit with `e2e: true` for the example app, on every pull request that touches the workflow or `tools/deploy/`, on
`master` and on demand. On that path:

- `build` builds the example app's image (`examples/next-app/Dockerfile`) without the GHCR login and without a push,
  and hands it to `deploy` as the artifact `deploy-e2e-image`;
- `deploy` builds this CLI from a full checkout of the tag instead of running the npm version, and
  [`e2e/start-server.sh`](e2e/start-server.sh) sets up its own runner (Ubuntu with Docker, cron and flock) as the
  server: the image goes into a registry on `localhost:5000` (the e2e app's image name), the compose file's Docker Hub
  images come from `mirror.gcr.io`, a certificate for `deploy-e2e.example.com` signed by a CA of the run waits in
  Traefik's ACME store (so Traefik never asks Let's Encrypt) and the name points at `127.0.0.1`, and `sshd` binds
  fresh keys to the forced command [`e2e/server/forced-command.sh`](e2e/server/forced-command.sh). The send step runs
  the production `ssh` command (host key checked) against it. The forced command first records the command line, the
  archive's files, their SHA-256, the mode of `.env.prod` and its names (never a value) with
  [`e2e/server/record.sh`](e2e/server/record.sh), uploaded as the artifact `deploy-e2e-received`, then runs the tag's
  `deploy.sh` from `/srv/softure-example/` unchanged: pull (logged in with the release's `.registry-token`, which the
  local registry accepts unchecked), backup, schema guard, switch, cron, `result|ok`. Its
  `npx @softure-ai/deploy@0.0.0` (the e2e app's pinned version, never published) is answered by
  [`e2e/server/bin/npx`](e2e/server/bin/npx) with the CLI built from the tag;
- `verify` would run on another runner, away from the stack, so `deploy` runs its two steps itself: the wait for
  `/api/health` and `softure-deploy verify https://deploy-e2e.example.com` with the e2e app's `deploy.json`, trusting
  the run's CA through `NODE_EXTRA_CA_CERTS`.

The caller's `report` job calls `deploy-report.yml` with `e2e: true` (refused outside SOFTURE/AI as well): the CLI
from the tag writes the report into a fixture body, uploaded as `deploy-report-body` instead of edited into a
release; [`e2e/check-report.sh`](e2e/check-report.sh) checks the owner's line, a status row per job and one
`deployed` row with the built image.

The caller's `assert` job runs [`e2e/check-received.sh`](e2e/check-received.sh): the image is
`localhost:5000/softure/ai-deploy-e2e:<sha>`, the command line `deploy <sha>`, the files are byte for byte the tag's,
and `.env.prod` (0600) holds exactly the compose file's required names, not the extra secret the caller also passes.
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
| `.github/workflows/release.yml` | the caller of `deploy-cut-release.yml` (below): *Run workflow* cuts the next date tag in `UTC` and starts `deploy.yml` on it |
| `deploy.json` | a `verify` starter: `/` without an error page, `/api/health` when the app has one, HSTS present, `x-powered-by` absent; with a database and `--tables`, `database.rowCountTables` |

- **Asked:** `--domain` and `--image`; `--paths`, `--www`, `--acme-email`, `--env` (the app's own secrets, added to
  the app service in the required form so `env render` renders them), `--tables` (what `row-counts` compares on
  the server, written into `deploy.json`; with a `deploy.json` that `init` keeps, add `database.rowCountTables` to it
  by hand) and `--name` (compose project, server folder `/srv/<name>`, database name; default from `package.json`).
- **Read from the app:** `@softure-ai/db` in `package.json` turns on the database part, `@softure-ai/ops` the
  `/api/health` route (else `/`), a `public/` folder its `COPY`; a `next.config.*` without `standalone` is a warning,
  and so is, with a database, one whose `serverExternalPackages` does not name `@softure-ai/db` (without it
  `next build` cannot resolve the driver the app does not install; see the `@softure-ai/db` README, §2).
  Nothing is read from `softure.config`.
- **Values are narrow:** the domain, image, name, paths, e-mail, env names and tables are checked against patterns
  before anything is written, so no value can break out of YAML, bash or a Traefik rule.
- **Secrets:** the compose file's required variables are the list the workflow renders: `POSTGRES_PASSWORD`,
  `SOFTURE_MIGRATOR_PASSWORD`, `SOFTURE_APP_PASSWORD` with a database, plus `--env`. Use URL-safe passwords
  (`openssl rand -hex 32`): they go into connection URLs as they are.

**`deploy.sh` on the server.** Once, by hand: copy `docker/server/deploy.sh` to `/srv/<name>/` (a folder the SSH
user owns) and bind the deploy key to it in `authorized_keys` (`command="/srv/<name>/deploy.sh",restrict …`). Every
release then brings the rest. It answers three commands in `SSH_ORIGINAL_COMMAND`, five with a database (anything
else, or more than one line, exits 2; `maintain` also takes a hook's name, below):

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
     itself by a rename (the new copy runs from the next release), reads the release's `deploy.json` through
     `softure-deploy server-settings` (the `settings` step; an invalid file stops the release before anything
     restarts) and pulls the image. A `.registry-token` in the
     archive (non-empty, or the release is refused) is never installed: the pull logs in with it under a
     `DOCKER_CONFIG` in the run's temporary folder, removed with it, so the host's own Docker login is neither used
     nor changed;
  3. with a database: starts Postgres, runs `backup` (`--keep=7 --max-age-days=30`), copies the migrations out of the
     new image for `schema-guard`, and saves `row-counts` (all through `npx @softure-ai/deploy@<this version>` on the
     host, or through the helper image on a host without Node, below; against `127.0.0.1`) for `database.rowCountTables` of the `deploy.json` this release shipped
     (`releases/<tag>/deploy.json`); without that file or key, and on the first release, the counts are skipped. The
     count before the switch runs against the old schema, so a table the release's own migration creates is
     counted as absent and may join the list in that release. With `database.appMigrations` it also copies the app's
     journal out of the new image and the schema step checks it against the app ledger (an image without that file
     stops the release); `database.excludeTableData` goes to the backup;
  4. runs the `pre-migrate` hooks (below), then keeps the replaced `.env.prod` as `.env.prod.prev` (0600) and switches: `docker compose up -d --wait` (the
     migrate service runs before the app); recreates Traefik when its rules changed (a running Traefik holds the
     rules it started with);
  5. with a database: `row-counts --compare`;
  6. records the tag in `.deployed-tag`, writes its crontab lines (below) and runs the `post-up` hooks.
- **`maintain`**, the daily cron's command: with a database a `backup` with the same retention, so no dump outlives
  30 days between releases either; then removes this app's image tags whose release folder is gone (the newest 5
  stay for a quick rollback; Docker refuses one a container uses) and the host's dangling images; then the `maintain`
  hooks without a schedule. **`maintain <hook>`** runs only that scheduled hook (its own crontab line); a name
  `deploy.json` does not schedule fails.
- **`run <script> [--key[=value] …]`** and **`report [--key=value …]`**, with a database: an ops script of the live
  image, or a read-only SQL file on stdin; see [Ops scripts and reports on the server](#ops-scripts-and-reports-on-the-server).

**Database access.** By default (`database.access: "host"`) the database steps connect to the Postgres the compose
file publishes on `127.0.0.1:5432` as `postgres` with `POSTGRES_PASSWORD`. With `"compose-exec"`, `pg_dump` and `psql`
run inside the `postgres` service (`docker compose exec -T postgres`, as `POSTGRES_USER` on `POSTGRES_DB` of
`.env.prod`, defaulting like the Postgres image) and the CLI reads their output with `--stdin`: for a Postgres that
publishes no port, and no `POSTGRES_PASSWORD` is needed. The dump lands in a hidden file in the backup folder first,
so a failed `pg_dump` leaves no dump behind.

**Hooks.** `deploy.json`'s `hooks` add the app's own steps at three points, in their order:

```json
{
  "database": { "access": "compose-exec", "appMigrations": { "journal": "/app/drizzle/meta/_journal.json" } },
  "hooks": {
    "pre-migrate": [{ "name": "migrate", "compose": ["run", "--rm", "migrate"] }],
    "post-up": [{ "name": "publish-content", "compose": ["exec", "-T", "app", "node", "publish.mjs"] }],
    "maintain": [
      { "name": "send-mail", "schedule": "0 9,21 * * *", "compose": ["exec", "-T", "app", "node", "send.mjs"] },
      { "name": "purge", "run": ["bash", "scripts/purge.sh"] }
    ]
  }
}
```

- A hook is `compose` (arguments of `docker compose` with this release's compose file and `.env.prod`) or `run` (a
  command run in the app folder; a script the release ships is installed `0644`, so run it through `bash`). Each gets
  `TAG`, `IMAGE` and `PREVIOUS_TAG`, prints `step|<name>|ok` when it succeeds, and its own output goes to stderr.
- `pre-migrate` runs before the switch: a failure puts the previous files back like any step before it. `post-up`
  runs once the release is live: a failure fails the release and rolls nothing back. `maintain` runs in the daily
  `maintain`, or, with a five-field cron `schedule`, on a crontab line of its own (`maintain <name>`, logged under
  `<name>-<hook>`).
- Names are lower case and unique across the points, and not a step name `deploy.sh` uses itself (`backup`,
  `switch`, …).
- Without a database the CLI is needed only for a `deploy.json` that has `hooks`.

**Restore.** A step that fails before the switch puts the saved files and `.env.prod` back (the rules by copying onto
the installed file, the script by a rename) and removes files and folders the release added; containers it already
started stay (a changed `postgres` service starts at step 3). From the switch on nothing is put back: the migrations
may have run, and old files over a new schema are worse than a stopped release. A rollback is a redeploy of the
previous tag, which the failure message names.

**Output.** One line per finished step on stdout, `step|<name>|ok[|<detail>]` (`archive`, `files`, `pull`,
`settings`, `postgres`, `backup`, `schema`, `row-counts-before`, `switch`, `traefik`, `row-counts-after`, `tag`, `cron`
and each hook's name; `restore` after a restore; `backup`, `images` and the hooks for `maintain`), and every `deploy` or `maintain` run, refused commands included,
ends with `result|ok` or `result|failed|<step>|<message>`. Messages for people start with `deploy:`.

**Cron.** Each release rewrites the deploy user's crontab lines marked `# softure-deploy:<name>`: `maintain`
daily at 03:17 server time, its output to syslog under `<name>-maintain` (`journalctl -t <name>-maintain`), and one
line per scheduled `maintain` hook. Other
lines, other apps' marked lines included, stay. `deploy` and `maintain` never run at the same time: both take
`.deploy.lock` with `flock` and wait up to 10 minutes for it.

Shipping `deploy.sh` widens nothing: whoever holds the deploy key already picks the image and its environment, and
the deploy user runs Docker, which is root on the host.

The host needs Docker with the compose plugin (a registry login only with `registry-token: false`), `cron` and
`flock` (both in Ubuntu's base system), and with a database Node.js 22 and `pg_dump` of the compose file's Postgres
major version, or neither: on a host without `node` and `npx`, `deploy.sh` builds a helper image once per CLI version
(`softure-deploy-tools:<version>-pg<major>`, from `node:22-alpine` with `postgresql<major>-client` and the CLI) and
runs the database steps in it with `--network host`, the deploy user's uid and the app folder mounted at the same path.
The build needs the registry and Alpine's package mirror once; a Postgres major Alpine does not package fails that
build, and with it the backup step, before anything restarts. CI generates the files for the example app, staged as a
standalone app, and builds its image from the generated `Dockerfile` (`npm run e2e:deploy-init`).

## Integration run

The remote integration run of the SOFTURE skills: `wt-integration.sh` (`softure-worktree`, `softure-worktree-manager`)
calls the commands `integration.remote` and `integration.lookup` of `context/workflow.json`, and these two meet that
contract with git alone, the same on a laptop and in a cloud session (no Docker, no GitHub API, no token beyond the
one `git push` already uses):

```json
"integration": {
  "remote": "npx softure-deploy integration run",
  "lookup": "npx softure-deploy integration lookup"
}
```

- **`softure-deploy integration run [--name=<n>] [--sha=HEAD] [--wait-minutes=30] [--remote=origin] [--main=<branch>]
  [--poll-seconds=15]`** pushes the commit to `integration/<name>` (`INTEGRATION_NAME`, `INTEGRATION_SHA` and
  `INTEGRATION_WAIT_MINUTES` stand in for the flags, as `wt-integration.sh` sets them), then fetches
  `refs/notes/integration` until the commit carries a new note, and prints it. It never replaces a ref: when
  `integration/<name>` already points at another commit, that is someone else's run and it exits 1; when it points at
  the same commit, it waits for that run without pushing. A run whose workflow never started leaves its ref behind;
  `git push origin --delete integration/<name>` clears it.
- **`softure-deploy integration lookup [--sha=HEAD] [--remote=origin] [--main=<branch>]`** prints the stored result of
  the commit (fetched first, the local notes when the remote cannot be reached), so `wt-integration.sh` reuses a green
  result for the same commit instead of a new run.
- **`softure-deploy integration record --sha=<sha> --ref=<ref> --result=green|red [--junit=<file>] [--run=<url>]`** is
  the workflow's side: it writes the note and pushes it, fetching and writing again when another run pushed its note
  first.

Both print the lines the contract names, on stdout (progress goes to stderr):

```text
integration: red
counts: 118/120
run: https://github.com/acme/app/actions/runs/7/attempts/1
red: checkout › refunds a failed payment
red: export › writes the PDF
new-red: export › writes the PDF
```

`counts` and the `red` names come from the suite's JUnit report when the workflow gets one; the result itself is the
test command's exit code. `new-red` lists the red tests the latest result on the main branch does not have red (the
newest first-parent commit of `<remote>/<main>` with a note; `--main`, else `mainBranch` of `context/workflow.json`,
else `main`). Without a main-branch result no `new-red` line is printed, which the contract reads as "every red is
new". No `flaky` lines: JUnit carries no portable signal for them.

| Exit | `run` | `lookup` |
| --- | --- | --- |
| `0` | green | a green result is stored |
| `1` | red, or the run could not start (remote unreachable, push refused, name in use) | a red result is stored |
| `3` | | no result for the commit |
| `75` | no result within `--wait-minutes` (retry later; the run may still finish) | |

The note is one line of JSON on the tested commit under `refs/notes/integration`: `result`, `sha`, `name`, the `ref`
that started the run, `passed` and `total` (null without a report), `red`, `run` (the Actions URL) and `finishedAt`.
A newer run on the same commit replaces it. `git notes --ref=integration show <sha>` prints it after
`git fetch origin refs/notes/integration:refs/notes/integration`.

### Integration workflow

[`deploy-integration.yml`](../../.github/workflows/deploy-integration.yml) is the CI side. The app copies
[`examples/integration.yml`](examples/integration.yml), which runs it on a push of `integration/**` and of the main
branch (the baseline for `new-red`), and sets its suite:

1. the `test` job checks out the pushed commit without credentials (`contents: read`), runs `setup-command`
   (default `npm ci`) and `test-command` with bash, and keeps the exit code as the result; the JUnit report at
   `junit-report`, if set, is uploaded. A red suite fails the job, so the run shows red in Actions too;
2. the `record` job (`contents: write`, none of the app's code) runs `softure-deploy integration record` from npm
   with the tested commit, its ref, the result and the run's URL, then deletes `integration/<name>`; the main branch
   stays. A suite job that died before the suite ran (checkout, setup) records red; a cancelled one records nothing,
   so `run` ends with exit 75.

Inputs: `test-command` (required), `setup-command`, `junit-report`, `node-version`, `deploy-cli-version` (this
package's version; the `integration` commands need the release after 0.1.4). The suite job has a two-hour limit. A
suite that needs a Docker image or services builds and starts them in its own commands: the runner has Docker.

## Ops scripts and reports on the server

An `@softure-ai/ops/scripts` script ([the ops README, "Safe ops scripts"](../../modules/ops/README.md#safe-ops-scripts))
or a SQL report runs against production from the operator's machine, through the same forced command as a release
(issue #247). The app keeps only the script definitions and the `.sql` files; no shell per script.

```bash
softure-deploy run --host=app-prod grant-access --email=a@example.com              # dry run
softure-deploy run --host=app-prod grant-access --email=a@example.com --commit     # writes
softure-deploy run --host=app-prod set-password --email=a@example.com --password-file=new-password.txt --commit
softure-deploy run --host=app-prod grant-access --help
softure-deploy report --host=app-prod reports/signups.sql --since=2026-10-01
```

**Setup, once per app** (an app `init` generated with this version has the first two):

1. One runner file per script in `scripts/ops/<name>.ts`, named like the script; definitions and their guard tests
   live elsewhere (a `*.test.ts` there is skipped):

   ```ts
   // scripts/ops/grant-access.ts
   import { runOpsScript } from "@softure-ai/ops/scripts";
   import config from "../../softure.config";
   import { grantAccess } from "../../src/ops/grant-access";

   process.exitCode = await runOpsScript({ script: grantAccess, argv: process.argv.slice(2), config });
   ```

2. The `Dockerfile` bundles them into `/app/ops/<name>.mjs` in the build stage, like `migrate.mjs`. An app generated
   before adds, after its migrate bundle, and next to its other `COPY --from=builder` lines:

   ```dockerfile
   RUN mkdir -p ops \
    && entries="$(find scripts/ops -maxdepth 1 -name '*.ts' ! -name '*.test.ts' 2> /dev/null || true)" \
    && if [ -n "$entries" ]; then \
         npx --yes esbuild@0.28.2 $entries --bundle --platform=node --format=esm --target=node22 \
           --external:pg --external:@electric-sql/pglite \
           --external:drizzle-orm/pglite --external:drizzle-orm/node-postgres --outdir=ops --out-extension:.js=.mjs; \
       fi
   COPY --from=builder /app/ops ./ops
   ```

3. `deploy.sh` of this version (a release ships it), and the operator's own key bound to it in `authorized_keys`, like
   the deploy key: `command="/srv/<name>/deploy.sh",restrict ssh-ed25519 AAAA… ops@<laptop>`. `--host` is an ssh host
   or a `~/.ssh/config` alias naming the user and that key (`--port` and `--ssh=<program>` when needed).

**`run`.** Client flags (`--host`, `--port`, `--ssh`) come before the script; every word after it is the script's,
`--help` included. The server checks the name (kebab-case) and each word (`--key` or `--key=value`), takes the deploy
lock (no script during a release), and runs `docker compose exec -T app node ops/<name>.mjs <words>` in the live app
container, so the script has the app's `DATABASE_URL` (the `softure_app` role: rows, not schema). A script the live
image lacks is refused with the list it has. stdin reaches the script, so `--<key>-file=-` reads it; a
`--<key>-file=<path>` is read on the operator's machine and sent on stdin as `--<key>-file=-` (one per run), so a
secret is on no command line, here or on the server. The exit status is the script's: 0 done (dry run or committed),
1 refused or failed (nothing written), 2 usage.

**`report`.** The file travels on stdin (at most 1 MiB) to `psql` in the postgres container, as `softure_app`, in one
transaction with `default_transaction_read_only=on` and `ON_ERROR_STOP`: an `INSERT`, `UPDATE` or DDL fails and
nothing is written. Each `--key=value` is a psql variable (`-` in the key becomes `_`), so values are quoted by psql,
never pasted into the SQL:

```sql
-- reports/signups.sql
select date_trunc('day', created_at) as day, count(*) from users where created_at >= :'since' group by 1 order by 1;
```

The output is psql's table; the exit status psql's (3 for a failed statement). Read only guards against mistakes; it
is not a sandbox: a file that switches the setting off, or a psql meta-command, runs. Whoever holds a key bound to
`deploy.sh` can deploy any image anyway, so the key is the boundary, not the file.

**What a value can hold.** The server splits the command line on blanks and evaluates none of it (no shell, no
expansion), so a value with a blank cannot pass: the CLI refuses it before connecting and points at
`--<key>-file`. Neither command prints `step|` or `result|` lines; the gateway's own refusals are exit 2 (a bad
name or word, before anything runs) or 1 (nothing deployed, the app or Postgres not running, an unknown script); ssh's
own failure is exit 1 with the host named. An app without a database has neither command.

## Library

The same steps as functions, for scripts that need them without the CLI:
`findComposeNames`, `findRequiredNames`, `renderEnvFile` (a result value: the text, or the missing and unsafe names),
`readReleaseCommits`, `findPreviousTag`, `toReleaseEntries`, `formatReleaseNotes`, `parseRoadmapItems`,
`selectShippingItems`, `writeReleaseSection`, `readReleaseSection`, `readSection`, `writeSection`, `parseDeployReport`,
`parseServerLines`, `writeReleaseReport`, `toLibpqEnv`, `createBackup`, `createBackupFromStream`,
`selectExpiredBackups`, `selectAgedBackups`, `hasCustomFormatHeader`, `guardSchema`, `guardLedgers`, `readAppJournal`,
`buildLedgerQuery`, `parseLedgerSnapshot`, `buildRowCountQuery`, `parseRowCountSnapshot`, `parseTableList`, `countRows`,
`compareRowCounts`, `parseDeployConfig`, `planServerSettings`,
`runVerify` (an injectable `fetch`), `checkResponse`, `formatVerifyReport`, `parseInitAnswers`, `readAppFacts`,
`planInitFiles` (pure: the files and their text), `writeInitFiles`, `parseIntegrationNote`, `formatIntegrationNote`,
`readJunitCounts`, `formatContractLines`, `lookupIntegration`, `recordIntegration`, `runIntegration` (injectable
`sleep` and `now`).

An app whose image should carry the guard itself (a host with neither Node nor a helper image) bundles a three-line
script around `withPgClient` and `guardSchema` with esbuild, like its `migrate.mjs`, and runs it from the new image:
`docker run --rm --network host --env DATABASE_URL <image>:<tag> node schema-guard.mjs /app/softure-migrations`.

## Parity with an adopting app's release scripts

The first app that adopted this package had release scripts of its own; they were read side by side with this
package on 2026-10-06 (DF-1; the full comparison is in
[`context/archive/2026-10-06-deploy-fire-parity/research.md`](../../context/archive/2026-10-06-deploy-fire-parity/research.md)).

**In the workflow (DF-11):** the tag must be on the default branch; build arguments, refused when one differs from the
value `.env.prod` holds under its name (the app compared two fixed names; any shared name is compared here);
non-secret values over secrets (the app read variables first for optional names only; here for every name, and the
names taken over a secret are listed); the deploy job's token per release (the app logged in and out on the host;
here a throwaway Docker config leaves the host's login alone).

**In the package:** optional compose names and the header line (`env render`); the release body section and the
roadmap table (`release-notes`); excluded table data, the age limit and the header check (`backup`); method, body and
request headers (`verify`); the origin firewall check (`verify --origin`, DF-13; a failure where the app only warned,
and a TCP handshake where the app's `curl` passed an open origin whose certificate does not cover the IP). Already
here before: names from the compose file, values never printed, mode 0600, the schema guard (stricter than a
migration count), row counts, status, markers, redirects, header and type checks, certificate expiry.

**In `init`'s `deploy.sh` (DF-9):** the read-only `status` command, the file and `.env.prod` restore when a release
fails before the switch, `.env.prod.prev`, the Traefik recreate when `traefik.yml` changed, the tag in `.env.prod`, a
daily cron for the backup age and old images, and the step and result lines the workflow checks. The app's gateway
and its second-stage script inside the image stay one script here: the release ships it (DF-7).

**Added for adoption (#246):** a tested image deployed by digest (`prebuilt-image`), the app ledger in the schema
guard, the `pre-migrate`, `post-up` and `maintain` hooks for the app's own steps, database steps through
`compose exec` for a Postgres without a published port, and `env render` from JSON objects.

**In the release report (DF-10):** the app's living report as `release-report` and `deploy-report.yml`: a status table
replaced by every run and a deployment history with the newest row on top (time, result, image and digest, backup
file, row counts before and after, verify, run). Different on purpose: times in UTC, not a local zone; no migration
count (no step line carries it); the "what's in it" part is `release-notes`' section, not a third writer.

**Kept different on purpose:** the custom dump format instead of plain SQL with gzip (compressed, restorable table by
table); `row-counts` fails on a drop, not on any change (a sign-up during a release is not a failure); seven dumps
by default instead of ten (`--keep`).

**The integration run (issue #248):** the app's integration scripts and workflow as
`softure-deploy integration run|lookup|record` and `deploy-integration.yml`, with the same contract. Different on
purpose: English names (`integration/<name>`, `refs/notes/integration`), and the suite runs in a job without a write
token. The app's own suite, image build included, stays its `test-command`.

**Stays in the app:** its tag pattern, its gates and integration suite inside the release run, checks of its own
secrets' shape, a workflow that rewrites the text above the report (which `--body` keeps), its markers inside
`<head>`, its IndexNow key and a 404 that only warns. Its dry runs, content sync and cron jobs become hooks.

## Exit codes

`run` and `report` end with the status of what ran on the server (above). Every other command: `0` done · `1` the command refused (missing names, unknown ref, unreadable or invalid file, a failed dump, a guard
problem, lost rows, a failed verify check, invalid init answers) · `2` a wrong command line. `integration run` and
`integration lookup` add `3` and `75` ([Integration run](#integration-run)).

## Limitations

- Release notes read only git: no labels, authors or pull request bodies (no GitHub API).
- `backup` writes to a local folder only; copying dumps off the server is the server's job.
- `verify` does not wait for the app to come up; the deploy workflow's health step does.
- Files a release no longer ships stay on the server; remove them by hand.
- A `deploy.sh` generated by 0.1.2 or earlier reads `.env.prod`, not the release archive, and prints no `result|ok`,
  which `deploy-app.yml` requires: copy the new one to the server once by hand (or run `init --force` and copy it),
  then every release ships it.
- A `deploy.sh` older than the registry token copies `.registry-token` next to itself like any other file (the token
  has expired by then): call the workflow with `registry-token: false` until a release has shipped the new script.
- `init` writes one app per VPS, with Traefik in the app's compose file.
- The end-to-end test stops at the server's forced command: neither the shipped `deploy.sh` nor the `verify` job runs
  there (DF-15).
