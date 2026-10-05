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
- **Headers:** a value is text the header must contain, case-insensitive; `null` means the header must be absent.
  `verify.headers` applies to every route; a route's entry for the same name wins.
- **Requests:** `GET` with `cache-control: no-cache`, redirects not followed, at most `--concurrency` at once
  (default 4), each within `verify.timeoutMs` (default 10000) or `--timeout`. A TLS, connection or timeout error
  fails that route with the reason; other routes still run.
- The schema is in [`schema/deploy.schema.json`](schema/deploy.schema.json) (`npm run schema -w @softure-ai/deploy`
  after changing `src/verify/schema.ts`). The route list is the app's; the package holds only the engine.

```text
Result  Status  Route     Detail
PASS    200     /         5 checks passed
FAIL    404     /pricing  status 404, expected 200; missing "Pricing"

verify: 2 routes at https://example.com, 1 passed, 1 failed
```

## Library

The same steps as functions, for scripts that need them without the CLI:
`findRequiredNames`, `renderEnvFile` (a result value: the text, or the missing and unsafe names),
`readReleaseCommits`, `findPreviousTag`, `toReleaseEntries`, `formatReleaseNotes`, `parseDeployConfig`, `runVerify`
(an injectable `fetch`), `checkResponse`, `formatVerifyReport`.

## Exit codes

`0` done · `1` the command refused (missing names, unknown ref, unreadable or invalid file, a failed verify check) ·
`2` a wrong command line.

## Limitations

- Release notes read only git: no labels, authors or pull request bodies (no GitHub API).
- `verify` does not warn about a certificate close to expiry (an expired or invalid one fails every route) and does
  not wait for the app to come up; the deploy workflow's health step does.
- Coming in later items of the deploy roadmap: `backup` and `schema-guard` (DP-3), `init` (DP-5), reusable
  workflows (DP-2).
