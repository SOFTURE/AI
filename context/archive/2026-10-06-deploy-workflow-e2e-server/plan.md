# Plan: deploy-workflow-e2e-server

Input: change.md, research.md. Complexity: medium (the test path of one reusable workflow, its caller, three scripts,
the committed e2e app, tests, README).

## Goal

On the `e2e` path of `deploy-app.yml` the release goes to the deploy job's own runner set up as the server: the
forced command records the release (DF-3's checks stay) and runs the tag's `deploy.sh` unchanged, which pulls the
image the build job handed over and brings the stack up; the deploy job then waits for the health route and runs
`softure-deploy verify` against `https://deploy-e2e.example.com`. A broken `deploy.sh`, `deploy.json` or `verify`
fails `e2e-deploy` on the pull request.

**Out of scope:** a second deploy over the first (rollback, row counts with a previous tag), `status` and `maintain`
over SSH (DF-9's `server-files.test.ts` runs them with stubs); changing `verify`, `deploy.sh` or init's templates.

## Approach

**Chosen** (research findings 1 to 7):

- `build` (test path only): `build-push-action` also writes `type=docker,dest=$RUNNER_TEMP/deploy-e2e-image.tar`;
  `upload-artifact` sends it as `deploy-e2e-image` (retention 1 day, no compression).
- `deploy` (test path only): `download-artifact` fetches it; the step "Set up this runner as the server (end-to-end
  test)" runs `tools/deploy/e2e/start-server.sh` with the image reference, compose file, server script, app URL and
  the tag's CLI. After the send and the recording's upload: "Wait for the health route (end-to-end test)" (the
  verify job's script, byte for byte) and "Verify the routes in deploy.json (end-to-end test)" (`node` on the tag's
  CLI with `NODE_EXTRA_CA_CERTS` from the server step's `ca-file` output); "Show the server's log and the stack" on
  every outcome; the cleanup removes the image folder too. The production path is unchanged.
- `start-server.sh` (rewritten): validates its inputs before touching anything (a `localhost:<port>` image registry,
  a host name in the app URL, plain paths for sshd's config); installs `openssh-server`, `cron`, `util-linux` only
  when missing; runs `registry:2` (from `mirror.gcr.io`) on the image's port, loads the archive and pushes it, then
  removes the local tag so `deploy.sh`'s pull is real; pulls the compose file's Docker Hub images from the mirror
  under their own names; makes a CA and a 90-day certificate for the host, seeds `acme.json` into
  `<project>_letsencrypt` (labelled as compose's), trusts the CA and maps the host to `127.0.0.1`; creates
  `/srv/<project>/` with the tag's `deploy.sh` (the first setup by hand); writes the forced command's env file;
  starts `sshd` on `127.0.0.1:<port>` (keys of the run, `AllowUsers` the runner's user, `UsePAM yes`, `StrictModes
  no` for keys under the temp folder) and waits for its banner; outputs `host`, `user`, `private-key`,
  `known-hosts`, `ca-file`.
- `server/forced-command.sh` (new): reads the env file, puts `server/bin` and the job's Node first on `PATH`; for
  `deploy <tag>` it stores stdin, runs `record.sh` on it with output to stderr, then runs `$APP_DIR/deploy.sh` with
  the same archive; any other command goes to `deploy.sh` directly.
- `server/bin/npx` (new): `npx [--yes] @softure-ai/deploy@<v> <args>` → `node $SOFTURE_DEPLOY_E2E_CLI <args>`;
  anything else exits 127.
- `server/record.sh`: no `result|ok` (finding 7); `RECEIVED_DIR` required. `server/Dockerfile` and
  `server/entrypoint.sh` go.
- The e2e app's image: `localhost:5000/softure/ai-deploy-e2e` (`scripts/write-e2e-app.ts`, regenerated with
  `npm run e2e-app`); `e2e-deploy.yml` passes it and expects it.

**Rejected:** `deploy.sh` inside DF-3's container (socket, path mirroring, host network, busybox crontab; finding
1); a stub `docker pull` (skips a real step); an `http://` or `--insecure` allowance in `verify` (Traefik redirects to
https, and a flag would reach production callers); Traefik's default certificate with TLS checks off (would hide a
broken certificate path); building the image again in the deploy job (twice the build time).

## Phase 1: Server scripts and the committed e2e app

**Discipline:** test-first.
**Files:** `tools/deploy/e2e/start-server.sh`, `tools/deploy/e2e/server/forced-command.sh`,
`tools/deploy/e2e/server/bin/npx`, `tools/deploy/e2e/server/record.sh`, `tools/deploy/e2e/server/{Dockerfile,entrypoint.sh}`
(removed), `tools/deploy/scripts/write-e2e-app.ts`, `tools/deploy/e2e/app/**` (regenerated),
`tools/deploy/tests/e2e-scripts.test.ts`.

1. Tests: the recorder prints no `result|` line; `forced-command.sh` with a stub `deploy.sh` records a deploy, hands
   `deploy.sh` the same bytes and command line, answers with `deploy.sh`'s stdout only and puts the stand-in `npx`
   first; `status` passes through unrecorded; a refused archive never reaches `deploy.sh`. `npx` maps the CLI call
   and refuses another package with 127. `start-server.sh` refuses a non-localhost image, an app URL without a host
   and a path with a blank before it creates its folder.
2. Scripts as above; shellcheck clean; the server half run locally in Docker (research, "Local run").

## Phase 2: The test path and the caller

**Discipline:** test-first for the repository test; the composed run is verified by `e2e-deploy` on the pull request.
**Files:** `.github/workflows/deploy-app.yml`, `.github/workflows/e2e-deploy.yml`, `tests/repo/deploy-workflows.test.ts`,
`tools/deploy/README.md`.

1. Repository tests: the image archive's output, upload and download exist only under `inputs.e2e`; every test-only
   deploy step (now nine) has an `if` naming `inputs.e2e`; the e2e wait step equals the verify job's; the e2e verify
   step uses the tag's CLI with `NODE_EXTRA_CA_CERTS`; the caller's image is a `localhost:<port>` one and is the image
   the committed compose file runs.
2. Workflow changes and the caller; README's end-to-end section.
3. Gates: typecheck, lint, test, build; actionlint 1.7.12 with shellcheck; the `e2e-deploy` run on the pull request
   green, its log showing `result|ok` from `deploy.sh` and the verify table.

## Progress

#### Automated
- [x] Phase 1: server scripts and the committed e2e app (`a694f98`; the recorder, forced-command and npx tests red before the scripts)
- [x] Phase 2: the test path and the caller (`a694f98`; one commit for both phases, the repository tests red before the workflow)

#### Manual
- [x] The `e2e-deploy` run on the pull request is green, with `deploy.sh`'s `result|ok` and verify's table in the log (PR #138 at `d90b694`: the real example image, 25 migrations applied, verify 2 of 2)
