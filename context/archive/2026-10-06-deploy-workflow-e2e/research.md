# Research: deploy-workflow-e2e

## 1. What a caller of a reusable workflow can reach

- Every job of `deploy-app.yml` runs on its own fresh runner. The caller's jobs run on other runners. Nothing the
  caller starts (a service container, a process) is reachable from the `deploy` job, and runners accept no inbound
  connections. **So the throwaway SSH server must start inside the `deploy` job itself**, which means a step in
  `deploy-app.yml` that runs only on the test path.
- The `github` context inside a called workflow is the caller's: `github.repository` is the repository that calls.
  A test input can therefore be refused unless the caller is `SOFTURE/AI`; an app that sets it fails in `check`
  before anything is built. This answers the roadmap's unknown: the input exists, and production callers cannot use
  it.
- A called job cannot hold more permissions than the caller grants. `build` asks for `packages: write`, so the caller
  grants it even when nothing is pushed (the e2e caller grants it on its calling job only).
- Results cannot leave the `deploy` job except through outputs, logs or artifacts. The recorded files go out as an
  artifact; the assertions run in the caller's job after the call, so they live in the caller and not in the reusable
  workflow.

## 2. The parts on the test path

- **Tag:** `check` takes a Docker tag (`[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}`); a 40-character commit SHA fits, and
  `actions/checkout` fetches a SHA as `ref` (also a pull request's merge commit, which GitHub advertises). The caller
  passes `github.sha`, so the image tag and the command line carry it.
- **Image:** the example app's own `Dockerfile` builds from the repository root (`examples/next-app/Dockerfile`,
  the same build `e2e:container` runs). On the test path `build` skips the GHCR login and builds with `push: false`:
  the Dockerfile is proven to build, nothing reaches a registry. A local registry was rejected: it would live on the
  `build` runner, which the server on the `deploy` runner cannot reach, so it would prove nothing more.
- **Server files:** the example app has no `docker/prod/` (DP-5 generated them for a staged copy in CI only). The
  test needs them in the tag, so init's output for the example app (its real facts read by `readAppFacts`) is
  committed under `tools/deploy/e2e/app/`, written by a script, with a test that fails when the committed copy and
  `planInitFiles` disagree (the pattern of `schema/deploy.schema.json`). Only what ships to the server is committed:
  `docker/prod/**`, `docker/server/deploy.sh`, `deploy.json`.
- **CLI:** `deploy-cli-version` defaults to 0.1.3, which waits for a release. The test path checks out the tag a
  second time in full, runs `npm ci` and `npm run build`, and calls `tools/deploy/dist/cli/main.js` instead of `npx`.
  The same gate as the test input keeps this to this repository (a full checkout of an app's tag would let its
  `.npmrc` steer `npm`, the reason the normal path checks out only the server files).
- **Server:** an `alpine` container with `openssh-server`, built from `tools/deploy/e2e/server/` in the deploy job,
  published on `127.0.0.1:<ssh-port>`. Host key and client key are generated in the job; the send step takes host,
  user, key and `known_hosts` from that step on the test path and from the secrets otherwise, so the `ssh` command
  itself is the production one (strict host key checking included). The key sits in `authorized_keys` with
  `command="/e2e/record.sh",restrict`, the shape `init` documents for the real server.
- **Record:** the forced command writes the command line, the archive's file list, each file's SHA-256 (not
  `.env.prod`), the mode of `.env.prod` in the archive and the names in `.env.prod` (never the values) into a mounted
  folder, which the job uploads as an artifact.
- **Verify:** the `verify` job needs the app served over HTTPS on a public name; the recorder does not run the app.
  It is skipped on the test path and recorded as a gap.

## 3. Checked locally

- Docker runs in the session (after `dockerd`), but the sandbox's proxy refuses Alpine's package mirror, so the
  server image cannot be built here; the scripts are tested with bash and `sh` against real tar archives instead, and
  the composed run happens in CI on the pull request.
- `actionlint` 1.7.12 (the CI pin) runs locally.

## 4. Risks

- Runner time: one extra image build of the example app per pull request that touches the deploy workflow,
  or `tools/deploy/` (paths filter), with the GitHub Actions build cache.
- The committed init output drifts when a template changes (DF-8 now): the drift test names the script to run.
