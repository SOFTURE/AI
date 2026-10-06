# Plan: deploy-workflow-e2e

Input: change.md, research.md. Complexity: medium (a test path through the reusable workflow, a caller workflow, two
scripts and a server image, committed init output, tests, README).

## Goal

`.github/workflows/e2e-deploy.yml` calls `./.github/workflows/deploy-app.yml` with `e2e: true` for the example app.
The `deploy` job starts a recording SSH server next to itself and sends the release to it with the production `ssh`
command; the caller's `assert` job checks what the server received. A pull request that touches the deploy workflow
or `tools/deploy/` runs it.

**Out of scope:** the `verify` job end to end (needs the app over HTTPS; recorded as a gap); running the shipped
`deploy.sh` on the server (DF-7's `server-files.test.ts` does that with a stub Docker); a registry push; the npm
publish and the caller tag (DP-8).

## Approach

**Chosen:** one boolean input `e2e` (default `false`) on `deploy-app.yml`, described as this repository's own test.

- `check` refuses `e2e: true` unless `github.repository` is `SOFTURE/AI`.
- `build`: the GHCR login is skipped and `push` is `false` on the test path; the rest is unchanged.
- `deploy`, test path only, after the normal sparse checkout: a full checkout of the tag into `.softure-ai-cli/`,
  `npm ci` and `npm run build` there; `tools/deploy/e2e/start-server.sh` builds the server image, generates the host
  and client keys, starts the container on `127.0.0.1:<ssh-port>` and writes `host`, `user`, `private-key` and
  `known-hosts` to its step outputs. The render step runs `node .softure-ai-cli/tools/deploy/dist/cli/main.js` instead
  of `npx` when `DEPLOY_CLI` is set (only on the test path). The send step's `SSH_*` values take the server step's
  outputs on the test path and the secrets otherwise; its script does not change. After it, the recorded folder is
  uploaded as the artifact `deploy-e2e-received`; the server's log is printed whatever happened. The cleanup step
  also removes the server folder (keys). The job's `concurrency` group gets `-e2e-<run id>` on the test path, so test
  runs never queue behind or cancel each other (production groups are unchanged).
- `verify`: skipped on the test path.

Server (`tools/deploy/e2e/server/`): `alpine` with `openssh-server`, `record.sh` copied in; the entrypoint creates
the user `deploy` with the password field `*` (Alpine's `adduser -D` locks the account, and sshd refuses a locked
account), installs the mounted host key and the authorized line with sshd's modes and runs `sshd -D -e`. The
container mounts only the server half of the keys and the `received/` folder. `start-server.sh` waits for the `SSH-`
banner through bash's `/dev/tcp` (no `ssh-keyscan`), at most 60 s, and prints the container log on a timeout.

Caller `e2e-deploy.yml`: `pull_request` and `push` to `master` with a paths filter (`deploy-app.yml`,
`e2e-deploy.yml`, `tools/deploy/**`), `workflow_dispatch`, concurrency per pull request. Job `deploy` calls the
workflow with `tag: ${{ github.sha }}`, the example's Dockerfile from the root, the committed server files under
`tools/deploy/e2e/app/`, `ssh-port: 2222`, placeholder SSH secrets and an `app-secrets` JSON of placeholder values
with one extra name the compose file does not require. Job `assert` checks out the tag's `tools/deploy/e2e/`,
downloads the artifact (`download-artifact@v8`, the repository's pin) and runs `tools/deploy/e2e/check-received.sh`.

`record.sh` (the forced command, POSIX `sh` in Alpine) reads stdin into a temp file and writes into
`$RECEIVED_DIR` (default `/e2e/received`): `command` (`$SSH_ORIGINAL_COMMAND`), `files` (sorted regular files of the
archive), `sha256` (`sha256sum` of every file but `.env.prod`), `env-mode` (the mode column of `./.env.prod` in
`tar -tv`), `env-names` (sorted names of `.env.prod`). It exits non-zero on an empty or broken archive.

`check-received.sh` (bash on the runner) takes `RECEIVED_DIR`, `APP_DIR`, `TAG`, `IMAGE`, `EXPECTED_IMAGE` and
`EXPECTED_ENV_NAMES` and asserts: `command` is `deploy <tag>`; `IMAGE` is `<expected image>:<tag>`; `files` is
exactly the compose folder's files plus `deploy.sh`, `deploy.json`, `.env.prod`; each shipped file's SHA-256 equals
the tag's file; `env-mode` is `-rw-------`; `env-names` equals `EXPECTED_ENV_NAMES` (a literal list in the caller,
not computed by the CLI). It prints one `ok:` line per check and every failure before it exits 1.

**Rejected:** a local registry (on the `build` runner, unreachable from the server on the `deploy` runner); service
containers declared in `deploy-app.yml` (the host key is unknown before the job, and a stock image cannot take a
forced command and a host key from the caller); running the workflow with `act` (GHCR login, buildx cache and the
buildkit network all behave differently, so a green run proves little); asserting inside `deploy-app.yml` (the
assertions belong to the test, not the workflow apps call); a separate `deploy-cli-from-checkout` input (a second
switch with the same gate; the checkout CLI is only safe in this repository anyway).

## Phase 1: Recorder, checker and the committed init output

**Discipline:** test-first.
**Files:** `tools/deploy/e2e/record.sh`, `tools/deploy/e2e/check-received.sh`, `tools/deploy/e2e/server/Dockerfile`,
`tools/deploy/e2e/server/entrypoint.sh`, `tools/deploy/e2e/start-server.sh`, `tools/deploy/scripts/write-e2e-app.ts`,
`tools/deploy/e2e/app/**` (generated), `tools/deploy/tests/e2e-scripts.test.ts`, `tools/deploy/package.json`
(script `e2e-app`).

1. Tests: `record.sh` with a real archive made like the pack step (stage folder, `.env.prod` 0600): the five files
   with exact contents; an empty stdin and a non-gzip stdin exit non-zero. `check-received.sh` green on a recorded
   folder that matches; red, naming the check, for a wrong command, a wrong image, a missing and an extra file, a
   changed byte, a 0644 `.env.prod`, an extra or missing env name. The committed `tools/deploy/e2e/app/` equals
   `planInitFiles` for the example's facts (only the shipped files) and the drift message names
   `npm run e2e-app -w @softure-ai/deploy`.
2. Scripts as above; shellcheck clean.

## Phase 2: The test path and the caller

**Discipline:** test-first for the repository test; the composed run is verified by the workflow on the pull request.
**Files:** `.github/workflows/deploy-app.yml`, `.github/workflows/e2e-deploy.yml`, `tests/repo/deploy-workflows.test.ts`,
`tools/deploy/README.md`.

1. Repository tests: `e2e` defaults to `false`; `check` refuses it outside `SOFTURE/AI`; every e2e-only step has an
   `if` naming `inputs.e2e`; the send step's run is unchanged and its env picks the server step's outputs only under
   `inputs.e2e`; `verify` is skipped under `inputs.e2e`; the caller passes only declared inputs and secrets, every
   required one, grants `contents: read` and `packages: write` on the calling job only, and its expected env names
   equal the compose file's required names in `tools/deploy/e2e/app/` (read with a regex here, not with the CLI).
2. Workflow changes and the caller; README (a section on the end-to-end test and the `e2e` input).
3. Gates: typecheck, lint, test, build; actionlint 1.7.12 with shellcheck over the workflows; the scripts run locally;
   the `e2e-deploy` run on the pull request green.

## Progress

#### Automated
- [x] Phase 1: recorder, checker and the committed init output (`84a6b58`; tests red before the scripts)
- [x] Phase 2: the test path and the caller (`84a6b58`; one commit for both phases, the repository tests red before the workflow)

#### Manual
- [ ] The `e2e-deploy` run on the pull request is green (CI, before merge)
