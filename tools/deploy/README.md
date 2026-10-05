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

## Deploy workflow

`SOFTURE/AI/.github/workflows/deploy-app.yml` is a reusable workflow that releases one app to its VPS. The app keeps
one caller, [`examples/deploy.yml`](examples/deploy.yml), with a single `uses:` line. For the release tag it:

1. checks every input (tag, URL, paths, image, command word, port, timeout) before anything runs;
2. builds the image from the tag and pushes `<image>:<tag>` to GHCR (the only job with `packages: write`);
3. renders `.env.prod` with `softure-deploy env render` from the `app-secrets` JSON and sends it on stdin to the
   server's forced SSH command as `<remote-command> <tag>`, checking the host key against `ssh-known-hosts`;
4. waits until `<app-url><health-path>` answers 200.

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
| `health-path`, `verify-timeout-seconds` | `/api/health`, `300` | verify |
| `deploy-cli-version` | this package's version | the CLI run from npm |

Secrets, all required and passed by name (no `secrets: inherit`): `ssh-host`, `ssh-user`, `ssh-private-key`,
`ssh-known-hosts` and `app-secrets` (a JSON object such as `toJSON(secrets)`; names like `PATH`, `HOME`, `NODE_*` and
`NPM_CONFIG_*` are refused). The workflow runs once this package is on npm; callers pin the `deploy-workflows-v1` tag
the owner sets, or its commit SHA.

## Library

The same steps as functions, for scripts that need them without the CLI:
`findRequiredNames`, `renderEnvFile` (a result value: the text, or the missing and unsafe names),
`readReleaseCommits`, `findPreviousTag`, `toReleaseEntries`, `formatReleaseNotes`.

## Exit codes

`0` done · `1` the command refused (missing names, unknown ref, unreadable file) · `2` a wrong command line.

## Limitations

- Release notes read only git: no labels, authors or pull request bodies (no GitHub API).
- Coming in later items of the deploy roadmap: `backup` and `schema-guard` (DP-3), `verify` (DP-4), `init` (DP-5).
- The deploy workflow checks only the health route until it runs `softure-deploy verify` (DP-4).
