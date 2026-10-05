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
  (refuses only an unset one). Optional forms (`${NAME}`, `${NAME:-default}`) and escaped `$${…}` are skipped, so
  the compose file stays the one list of what production needs.
- **Values come from the environment** (in CI: `env:` from the repository secrets). A missing name stops the
  command with every missing name listed; nothing is written.
- **Values are never printed**, on success or on failure: the output names variables and counts only.
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
softure-deploy backup [--dir=backups] [--prefix=db] [--keep=7] [--url-env=DATABASE_URL] [--pg-dump=pg_dump]
```

- Runs `pg_dump --format=custom` (restore with `pg_restore`) into `<dir>/<prefix>-<UTC yyyymmddThhmmssZ>.dump`.
- **The password stays out of the process list:** the URL is split into libpq variables (`PGHOST`, `PGPASSWORD`, …)
  for `pg_dump`, and other `PG*` variables of the shell are not passed on. A URL query parameter without a libpq
  variable is refused by name.
- The dump is written with mode `0600` through a temporary file and a rename; a failed `pg_dump` leaves no file.
- **Retention** runs only after a dump succeeded: the newest `--keep` dumps of `--prefix` stay, older ones of that
  prefix are removed and named in the output. Other files in the folder are never touched.
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
softure-deploy row-counts --tables=<a,b.c> [--out=<file>] [--compare=<file>] [--url-env=DATABASE_URL]
```

- Counts the rows of each table (`table` or `schema.table`, lower snake case; the app's key tables, like FIRE's
  `users`, `snapshots`, `position_values`) and prints one line per table.
- `--out` saves the counts as JSON (`{ "takenAt", "counts" }`); `--compare` reads such a file and prints
  `before -> after (delta)`. A table with fewer rows than before, or not counted before, fails the step (exit 1); the
  deploy script decides whether that rolls the deploy back. `count(*)` reads every row: keep the list to the tables
  whose loss would matter.

## Library

The same steps as functions, for scripts that need them without the CLI:
`findRequiredNames`, `renderEnvFile` (a result value: the text, or the missing and unsafe names),
`readReleaseCommits`, `findPreviousTag`, `toReleaseEntries`, `formatReleaseNotes`, `toLibpqEnv`, `createBackup`,
`selectExpiredBackups`, `guardSchema`, `parseTableList`, `countRows`, `compareRowCounts`.

## Exit codes

`0` done · `1` the command refused (missing names, unknown ref, unreadable file, a failed dump, a guard problem, lost
rows) · `2` a wrong command line.

## Limitations

- Release notes read only git: no labels, authors or pull request bodies (no GitHub API).
- `backup` writes to a local folder only; copying dumps off the server is the server's job.
- Coming in later items of the deploy roadmap: `verify` (DP-4), `init` (DP-5), reusable workflows (DP-2).
