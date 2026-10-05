# Research: deploy-reusable-workflows

Date: 2026-10-05 · Sources: roadmap DP-2, `docs/06-fire-extraction-2.md`, `.github/workflows/{blog-links,release,ci}.yml`,
`tools/deploy` (DP-1), GitHub's reusable-workflow rules, actionlint 1.7.12.

## What exists

- **House pattern** (`blog-links.yml`): `on: workflow_call` with typed inputs, top-level `permissions: contents: read`,
  inputs reach scripts only through `env:` (never `${{ }}` inside `run:`), a commented caller in the header, callers
  pin `@master` today.
- **DP-1 CLI** (`tools/deploy`, 0.1.0, `private` until DP-8): `softure-deploy env render [--compose=…] [--out=…]`
  reads `${NAME:?}` names from the compose file (default `docker/prod/docker-compose.yml`) and writes `.env.prod`
  (mode 0600) from the process environment; it prints names only. Not on npm yet, so the workflow cannot run before
  DP-8 publishes it.
- **Example app**: health route `/api/health` from `@softure-ai/ops`; a `Dockerfile` in `examples/next-app/`.
- **actionlint**: 1.7.12 is clean on every current workflow without shellcheck. With shellcheck (present on GitHub's
  Ubuntu runners) it reports two notes in `release.yml`: SC1007 on `NODE_AUTH_TOKEN= npm view` (intended empty
  assignment) and SC2016 on a single-quoted `node -e` program (intended). Both are silenced by spelling, not by
  changing behaviour.
- **FIRE_TRACKER** `release.yml` and `auto-release.yml`: could not be read from this session (cloning is refused, as in
  DP-1). The steps come from the roadmap item; parity with FIRE becomes a `deploy-followups` gap.

## GitHub rules the design relies on

- A caller's `jobs.<id>.secrets.<name>` may use the `secrets` context and `toJSON`, so an app can pass all its secrets
  as one JSON value (`toJSON(secrets)`) or name each one; `secrets: inherit` is not needed.
- A reusable workflow job may set `environment`; an empty name means no environment, so the input can default to `""`.
  Environment secrets then override caller secrets of the same name.
- `GITHUB_TOKEN` permissions of the called jobs are capped by the caller's; the caller must grant `packages: write`.
- A nested `uses: ./…` inside a called workflow is resolved against the caller's repository, so the build, deploy and
  verify steps live as jobs of one file instead of three files that call each other.

## Answers to the roadmap unknowns

1. **Versioning:** callers pin a tag the owner sets at DP-8, `deploy-workflows-v1` (a moving major tag, like
   `actions/checkout@v7`); a caller that wants immutability pins the commit SHA the tag points at. The tag name has no
   `@`, so it never matches the per-package release tags (`<package>@x.y.z`) `release.yml` reacts to.
2. **Private repository access:** `SOFTURE/AI` is **public** (GitHub API, 2026-10-05), so any repository, including
   `jarmatys/FIRE_TRACKER` under another owner, can call its reusable workflows; the Settings → Actions → Access check
   is not needed. (Were it private, only repositories of the same owner could call it, which would exclude
   FIRE_TRACKER.)

## The two domain spots

The image name (`ghcr.io/<owner>/<repo>`, default derived from the caller's repository, lower-cased) and the public
URL (the verify target and the environment URL). Both are inputs; the URL is required.
