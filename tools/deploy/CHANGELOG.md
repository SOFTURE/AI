# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/deploy`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`deploy@x.y.z`).

## 0.1.8

- `verify` takes the checks an app kept in a shell script (issue #309):
  - `severity: "warn"` on a route, and `verify.originSeverity: "warn"` for the `--origin` row: a failed row prints
    `WARN`, the summary adds `, N warned`, and the run still passes. Default `fail`, as before.
  - `sha256` on a route (`sha256:<hex>` or the bare hex): the SHA-256 of the response's exact bytes must match.
  - `within: "head"`: `contains`, `excludes` and `count` look only between `<head>` and `</head>`.
  - `count: { "<marker>": n }`: the marker occurs exactly n times.
  - `forEach` instead of `path`: `{ "sitemap": "/sitemap.xml", "match": "/blog/" }` checks the route for every
    matching `<loc>`, `{ "index": "/.well-known/agent-skills/index.json" }` for every entry of an Agent Skills index,
    each against the entry's `digest`. Each entry is a row, requested on the verified URL's origin with the route's
    request headers; an unreadable source or no entry is one failed row naming it.
  - `webBotAuth` on a route (issue #341): each request of the route, a `forEach` source and its entries included, is
    signed with Web Bot Auth (RFC 9421, Ed25519, tag `web-bot-auth`, the profile `@softure-ai/agent-ready` signs
    with). `keyEnv` names the variable holding the seed (default `WEB_BOT_AUTH_PRIVATE_KEY`), `agent` the
    `Signature-Agent` origin (default the verified URL's origin). An unset or malformed variable fails the route
    with its name and sends nothing; the key never reaches `deploy.json` or the report. `runVerify` takes `env`
    (default `process.env`); `readWebBotAuthKey` and `getWebBotAuthHeaders` are exported.
  - For TypeScript callers: `VerifyRoute.path` is optional (a `forEach` route has none), and `ObservedResponse` takes
    an optional `sha256`.

## 0.1.7

- `init` reads an existing `docker/prod/docker-compose.yml`: `deploy.sh`'s tools image carries the `pg_dump` of the
  `postgres` service's major (`postgres:17-alpine` → `-pg17`, `postgresql17-client`) instead of a fixed 16, and
  `report` reads as the role of the `app` service's `DATABASE_URL` instead of a fixed `softure_app` (a compose file
  `--force` replaces keeps the major, and `softure_app`). A value init cannot read there is a warning naming the default.
- `init --workflows-ref=<sha>` pins both callers' `uses:` to that commit of SOFTURE/AI; without it they call `master`
  and a warning prints how to get the commit of the `deploy@<version>` release. The callers, the examples and the
  README no longer name `deploy-workflows-v1`, a tag that never existed.
- `deploy-app.yml` takes `secrets-from-environment: true` (with `environment` and `secrets: inherit`): the deploy job
  renders `.env.prod` from its own secrets, where the environment's win over the repository's, and sends with the
  secrets `ssh-host-secret`, `ssh-user-secret`, `ssh-private-key-secret` and `ssh-known-hosts-secret` name (defaults
  `DEPLOY_SSH_HOST`, `DEPLOY_SSH_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_SSH_KNOWN_HOSTS`). Secrets behind an environment's
  deployment policy reach the release without repository-level copies. `origin-address-var` takes the verify job's
  origin address from an `app-vars` entry. Without the flag nothing changes, except that the named secrets are no
  longer `required: true`: the check job names a missing one before anything is built.

## 0.1.6

- A `verify` header check also takes a list of texts (`"vary": ["accept", "accept-encoding"]`): the header value must
  contain every item, case-insensitive; each item is one check in the route's row. A text and `null` work as before.

## 0.1.5

- `deploy-app.yml` takes `prebuilt-image` (`<image>@sha256:<digest>` from the `image` repository): an image the app
  already tested is tagged with the release tag and deployed as it is, never rebuilt.
- `schema-guard --app-journal=<file> [--app-ledger=<schema.table>]` also refuses an image whose own migration journal
  (drizzle's) lists fewer migrations than the app ledger ran.
- `backup --stdin`, `schema-guard --stdin` and `row-counts --stdin` read what `pg_dump` and `psql` printed elsewhere,
  so the CLI needs no connection; `schema-guard --print-query` and `row-counts --print-query` print the statement.
- `env render --from-json-env=<NAME>` (repeatable) takes the values from JSON objects such as `toJSON(secrets)`, a
  later one over an earlier one.
- `deploy.json` adds `database.access` (`host` or `compose-exec`), `database.appMigrations`,
  `database.excludeTableData` and `hooks` (`pre-migrate`, `post-up`, `maintain`, the last with an optional cron
  `schedule`); `server-settings` writes them out for `deploy.sh`.
- `init`'s `deploy.sh` reads the release's `deploy.json` in a new `settings` step, runs the hooks, `maintain <hook>` on
  a hook's own crontab line, and with `compose-exec` runs `pg_dump` and `psql` in the `postgres` service. The CLI before this
  version refuses a `deploy.json` with these keys: move `deploy.sh` and `deploy-cli-version` to this version together.
- `integration run`, `integration lookup` and `integration record`: the remote integration run of the SOFTURE skills
  (`integration.remote` and `integration.lookup` in `context/workflow.json`). `run` pushes `integration/<name>` and
  waits for the result note on the commit (exit 0 green, 1 red, 75 no result in time); `lookup` prints a stored result
  (0 green, 1 red, 3 none); both print `integration:`, `counts:`, `run:`, `red:` and `new-red:` lines.
- `deploy-integration.yml` and `examples/integration.yml`: the CI side, which runs the app's suite on the pushed
  commit, stores the result under `refs/notes/integration` and deletes the ref.
- `softure-deploy run --host=<ssh host> <script> [--commit] [args]` runs an `@softure-ai/ops/scripts` script of the
  live image in the app container on the server, and `softure-deploy report --host=<ssh host> <file.sql> [--key=value]`
  a SQL file through `psql` in one read-only transaction, each argument a psql variable (issue #247). Both go
  through `init`'s `deploy.sh`, which answers `run` and `report` with a database; a `--<key>-file=<path>` is read
  locally and sent on stdin.
- `init`'s `Dockerfile` bundles every `scripts/ops/<name>.ts` into `/app/ops/<name>.mjs`. An app generated before
  adds the lines shown in the README, "Ops scripts and reports on the server".

## 0.1.4

- `init` warns when the app depends on `@softure-ai/db` and its `next.config.*` does not list `"@softure-ai/db"` in
  `serverExternalPackages` (the `@softure-ai/db` README, §2 Installation), next to the `standalone` warning.
- `deploy-app.yml`'s check and pack steps also run with bash 3.2 and bsdtar (macOS, where the tests run them); on the
  runner they behave as before.

## 0.1.3

- `init`'s Dockerfile keeps drizzle's driver adapters external in the migrate bundle, so an app that installs one
  database driver only starts `migrate.mjs`.
- On a host without Node, `init`'s `deploy.sh` runs the database steps in a helper image (`softure-deploy-tools:<version>-pg<major>`).
- Each release ships the server files with `.env.prod` in one archive; `deploy.sh` restores files when a release fails before the switch, prints step and result lines, and answers `status` and `maintain` (daily backup retention and image cleanup).
- `backup --exclude-table-data` and `--max-age-days`, and a refused dump without its header.
- `row-counts` reads its tables from `deploy.json` and counts a table the old schema lacks as absent.
- `verify`: method, body and request headers per route, TLS expiry (`verify.tlsMinDays`), `--origin` against a server reachable around the CDN.
- `release-notes` writes a release body section; `release-report` writes the pipeline status and a deployment row.
- `deploy-app.yml` guards the release branch, takes build arguments and app variables, sends a registry token; `deploy-cut-release.yml` and `deploy-report.yml`; `init` writes the release caller.
- `env render` writes the optional compose names the environment sets.
