# Plan: deploy-reusable-workflows

Input: change.md, research.md. Complexity: medium (one workflow file, an example caller, a repository test, a CI job).

## Goal

`.github/workflows/deploy-app.yml` (`on: workflow_call`) builds, deploys and verifies a release of the calling app;
`tools/deploy/examples/deploy.yml` calls it with one `uses:` line; actionlint and a repository test guard both.

**Out of scope:** the server side of the forced command (DP-5 generates `deploy.sh`; the SSH gateway is
`softure.vps_foundation`), backup and schema guard (DP-3), `softure-deploy verify` (DP-4), the tag callers pin (DP-8).

## Approach

**Chosen:** one reusable file with four jobs: `check` (validates every input before anything runs), `build`
(GHCR push, `packages: write` only here), `deploy` (env render + SSH, the only job with the app's secrets),
`verify` (health route with retries, no permissions). Every input and secret reaches a script through `env:`.
The server contract: `ssh … "<remote-command> <tag>" < .env.prod`, host key checked against a known-hosts secret.
App secrets arrive as one JSON secret (`app-secrets`, e.g. `toJSON(secrets)`); a short Node step merges it into the
environment of `npx @softure-ai/deploy@<version> env render`, which keeps only the compose file's required names.
**Rejected:** three files calling each other (nested `./` resolves in the caller's repository); `secrets: inherit`
(the roadmap asks for explicit secrets); a new CLI flag for JSON secrets (`tools/deploy/src/cli/` is shared with
DP-3 and DP-4 right now); `StrictHostKeyChecking=no` or `ssh-keyscan` (trust on first use against a live server).

## Phase 1: Reusable workflow and example caller

**Discipline:** test-first for the repository test (the test file is written before the workflow, then made green).
**Files:** `tests/repo/deploy-workflows.test.ts`, `.github/workflows/deploy-app.yml`, `tools/deploy/examples/deploy.yml`,
`tools/deploy/README.md`.

1. Test: every `deploy-*.yml` triggers only on `workflow_call`, sets top-level permissions and per-job permissions,
   puts no `${{ inputs.* }}`, `${{ secrets.* }}` or `${{ github.event.* }}` inside a `run:` script, and never disables
   host key checking; the example's `uses:` names an existing workflow, passes every required input and secret, only
   declared ones, and no `secrets: inherit`; the workflow's default CLI version equals `tools/deploy/package.json`.
2. Workflow: inputs `tag`, `app-url` (required), `image`, `context`, `dockerfile`, `compose-file`, `environment`,
   `remote-command`, `ssh-port`, `health-path`, `verify-timeout-seconds`, `deploy-cli-version`, `node-version`;
   secrets `ssh-host`, `ssh-user`, `ssh-private-key`, `ssh-known-hosts`, `app-secrets` (all required).
   `check` validates tag (Docker tag rules), URL (`https://` host, no path), image, remote command, port, path and
   timeout; `deploy` has `concurrency` per repository and environment, never cancelled; key and env file removed in an
   `always()` step.
3. Example caller: on `release: published` and `workflow_dispatch` with a tag; `permissions: contents: read,
   packages: write`; pinned to `@deploy-workflows-v1`.
4. README: a "Deploy workflow" section (inputs, secrets, the server contract, the tag).

## Phase 2: actionlint in CI

**Discipline:** verify (reproduce the shellcheck notes, then show actionlint clean).
**Files:** `.github/workflows/ci.yml`, `.github/workflows/release.yml`.

1. `ci.yml` job `workflows`: download actionlint 1.7.12, check its SHA-256, run it over `.github/workflows/` and the
   example caller.
2. `release.yml`: `NODE_AUTH_TOKEN=''` (same empty value) and a `# shellcheck disable=SC2016` above the intended
   single-quoted program.
3. Gates: typecheck, lint, test, build; actionlint locally with shellcheck.

## Progress

#### Automated
- [ ] Phase 1: reusable workflow and example caller
- [ ] Phase 2: actionlint in CI

#### Manual
- [ ] DP-8 (owner): set the `deploy-workflows-v1` tag after `@softure-ai/deploy` is on npm.
