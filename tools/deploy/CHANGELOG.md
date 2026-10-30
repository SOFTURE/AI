# Changelog

Newest first. Each version lists what changed for an app that uses `@softure-ai/deploy`. When an app has run a version in
production, the version gets a line `verified in: <app>@<commit>` ([docs/05](../../docs/05-adoption-playbook.md),
"Definition of done"). Versions before the first one below are described in their GitHub Releases (`deploy@x.y.z`).

## Unreleased

- **Cloudflare Tunnel (#905):** `init --tunnel` publishes the app through a Cloudflare Tunnel of its own compose project
  instead of a Traefik: a pinned `cloudflared` (`read_only`, `cap_drop: ALL`, `no-new-privileges`) on its own network
  `tunnel`, the token as the required secret `CLOUDFLARE_TUNNEL_TOKEN`, the app with `traefik.enable=false` and
  `depends_on` the tunnel, no Traefik service, rules file or port. init prints the steps it leaves to the owner (the
  tunnel and its public hostname `http://app:3000`, the secret, the security headers the app now sends itself); the
  README has them with a `next.config` headers snippet. `--tunnel` refuses `--edge`, `--cdn`, `--acme-email`, `--www`
  and `--paths` other than `/`. `CLOUDFLARE_TUNNEL_TOKEN` is no longer accepted in `--env`.
- `checkSharedHostCompose` (`@softure-ai/deploy/testing`) takes `ingress: "tunnel"`: no `edge-network-missing`; instead
  `edge-network-joined` (a network names the edge one) and `traefik-routing` (any `traefik.*` label but
  `traefik.enable=false`). The default `ingress: "edge"` checks as before.
- The comments of the generated `deploy.sh` name the Traefik step as "only with its own Traefik". Nothing to do for an
  app generated earlier.

## 0.4.9

- The content of 0.4.8, which was never published: its release stopped at the gates (ESLint ran out of memory in
  `release.yml`) before publishing, and a tag is never moved.

## 0.4.8

- **Smoke check after a deploy (#878):** `softure-deploy smoke <url> --tag=<tag> [--commit] [--deployed-at]
  [--path=/api/health/build] [--headers-file]` reads the app's build info (`@softure-ai/ops`) and fails when it
  answers another release, another commit or a process started before the deploy. `deploy-app.yml` takes
  `build-info-path` and runs it after verify; the deploy action takes `build-info-path`, `build-info-headers` and
  `deployed-at` and has a new output `sent-at`. The job summary gets `Smoke check: passed` or `failed`, and a failed
  smoke check is a failed verify in the release report. Empty `build-info-path` (the default) changes nothing.
- The build jobs of `deploy-app.yml` and `deploy-release-image.yml` pass the commit as the build argument
  `SOFTURE_BUILD_COMMIT`; a caller's own `SOFTURE_BUILD_COMMIT` in `build-args` is refused. A Dockerfile without the
  `ARG` ignores it.
- `init` writes `SOFTURE_RELEASE: ${TAG}` on the app service of the compose file and `ARG SOFTURE_BUILD_COMMIT` before
  `npm run build` in the Dockerfile. An app generated earlier adds both lines (or re-runs `init --force`).
- `softure-deploy changelog [--roadmaps=2] [--out=<file>]` writes the newest roadmaps' `done` and `done_code` items
  (id, change id, status) as JSON, for the build info route's changelog.

## 0.4.7

- **A release cuts and reports on a self-hosted runner without the GitHub CLI (#686):** the jobs that call `gh`
  (`deploy-cut-release` → `cut`, `deploy-report` → `report`, `deploy-release-notes` → `notes`, `deploy-cancel-run` →
  `cancel`, `deploy-integration` → `record`) no longer stop at `gh: command not found`. When the runner has no `gh`,
  the step "Set up the GitHub CLI" downloads GitHub CLI 2.103.0 for Linux x64 or arm64, checks it against its pinned
  SHA-256, unpacks it into `$RUNNER_TEMP` for that job and puts it on `PATH`, with no `sudo`. Any other platform, a
  missing `curl` or `tar`, a failed download or a wrong checksum fails the step with a message that names the cause.
  Nothing to do for an app on GitHub's hosted runners, which have `gh`. An app's own steps that call `gh` on a
  self-hosted runner install it themselves (README "Runner").
- **Bundles that include `@softure-ai/observability` 0.4.0 load again (#681):** the esbuild banner of the `Dockerfile`
  written by `init` imports `createRequire as __bundleCreateRequire`, so it no longer collides with observability's own
  top-level `createRequire` import (`SyntaxError: Identifier 'createRequire' has already been declared` when
  `migrate.mjs`, `worker.mjs` or an `ops/<name>.mjs` bundles `startObservability`). An app generated earlier replaces
  the banner of each esbuild command in its `Dockerfile` with
  `--banner:js="import { createRequire as __bundleCreateRequire } from 'module'; const require = __bundleCreateRequire(import.meta.url);"`
  (or re-runs `init --force`); README "Bundled for plain Node" explains why.
- **Jobs on a reused self-hosted runner get the whole commit (#687):** a runner that keeps its work directory between
  jobs kept the sparse checkout of an earlier job (`deploy-release-checks.yml`'s `prepare` checks out only
  `package.json`), so the next job's full checkout left just those files and `setup-node` failed with "Dependencies
  lock file is not found". Every job of the reusable workflows that checks out now empties the workspace first, as a
  hosted runner does. Nothing to change in the caller; a job fails, naming the workspace, when it cannot remove a file
  there (another user's, e.g. a container's volume). The app's own jobs on such a runner need an ephemeral runner or a
  job-started hook that empties the workspace (README "Runner").
- **An integration run deletes its ref again (#684):** `deploy-integration.yml`'s step "Delete the integration ref"
  called `DELETE repos/<owner>/<repo>/git/heads/<branch>`, which is not an endpoint: GitHub answered 404, every
  `integration/*` run ended red after storing its note, and the ref stayed. The step now calls
  `git/refs/heads/<branch>`. Nothing to change in the caller; delete the `integration/*` branches earlier runs left
  behind (`git push origin --delete integration/<name>`, or the repository's Branches page).

## 0.4.6

- **The runner is the caller's choice (#670):** every reusable workflow takes the input `runs-on`, JSON: one label
  (`'"ubuntu-latest"'`, the default) or an array of labels (`'["self-hosted","linux"]'`), and every job runs there.
  Each job checks the value first and refuses an object, an empty array, an empty label or a number, naming
  `runs-on`. Nothing to do for an app that stays on GitHub's hosted runners; README "Runner" lists what a self-hosted
  runner has to provide and why a public repository must not use one.

## 0.4.5

- **A pull request's checks cost less (#627):** `deploy-release-checks.yml` skips `prepare` when there is no tag and
  one shard (a pull request's run), so the job no longer bills a minute for seconds of work; `static` and each `unit`
  shard check the inputs themselves first, and the output `sha` is the caller's commit. With a tag or several shards
  nothing changes. The new input `static-cache-paths` (default empty, no cache) keeps files such as `.eslintcache`
  and `*.tsbuildinfo` between runs of `static`; pass them with a command that writes them (`eslint --cache`,
  `tsc --incremental`), README "Release checks". Nothing to do for an app that wants neither.
- **A failed release attempt stops at once (#628):** a release pipeline no longer pays for jobs after one part has
  failed, nor finds a missing deploy secret after an hour of green checks. New, all opt-in:
  `deploy-cancel-run.yml` (cancels the calling run; a watcher job per part calls it with `actions: write`),
  `deploy-release-checks.yml`'s `fail-fast` (a red shard cancels the others), `deploy-app.yml`'s `build: false` (the
  check job alone) and output `sha` (the tag's commit), and the deploy action's `preflight` (the SSH values and
  `.env.prod` checked, nothing sent). Before every send the action now checks the SSH values the same way, so an empty
  secret, a key with a passphrase or known hosts without the server fail with the input's name instead of an ssh
  error. An app adopts it by replacing its deploy caller with
  [`examples/deploy-pipeline.yml`](examples/deploy-pipeline.yml) (its app URL, secrets and check commands carried
  over), README "Fail fast". Nothing changes for an app that keeps its caller.

## 0.4.4

- **A release runs the `deploy.sh` it ships (#621):** `deploy.sh` installs its successor by a rename and used to
  finish the release itself, so a release whose new script starts a new service (0.4.3's switch adds `worker`) was
  run by the old script: the service never started, and the deploy still reported `result|ok`. Now, after the archive
  checks and before anything is installed, a running script whose release ships a different `deploy.sh` hands the
  whole release to it (same command, same archive, the lock kept, from a copy in the run's temporary folder) and ends
  with its status; the step and result lines are the shipped script's. A shipped script without the hand-off (older
  than this version, e.g. a rollback to an old tag) is run by the running copy as before. An app adopts it in three
  steps:
  1. bump `@softure-ai/deploy` to this version and take the new `docker/server/deploy.sh`: re-run `init --force`
     into a scratch folder and copy that file, or apply the template's diff to a script the app changed (the
     `HANDOFF_FROM` lines, `take_lock`, and the hand-off block after the archive's reserved-name check);
  2. ship it in a release that needs nothing else from the new script: that release is still run by the old copy,
     which installs the new one; every later release is run by the script it ships;
  3. an app already hit by the issue (a `worker` service with no container after moving to 0.4.3) starts it once by
     hand with the live tag, `flock .deploy.lock docker compose --env-file .env.prod --file docker-compose.yml up
     --detach --wait --no-deps worker` in `/srv/<name>/`, or publishes one more release (the 0.4.3 script installed
     by the last one starts it).

## 0.4.3

- **The worker's health check asks its loop (#610):** with `@softure-ai/jobs` 0.1.3 or later (installed, else the
  lowest version of the app's range), `init` writes `scripts/worker.ts` with
  `healthFile: "/tmp/softure-jobs-worker.alive"` and the `worker` service's check
  `test: ["CMD", "node", "worker.mjs", "--health"]`, which fails when the loop has not reached the database for five
  poll intervals (at least 30 s), not only when the process is gone. With an older jobs it keeps the PID 1 check and
  warns. An app with a worker upgrades `@softure-ai/jobs` first, then changes the `runJobWorkerProcess` call in its
  `scripts/worker.ts` to `await runJobWorkerProcess({ config, handlers, healthFile: "/tmp/softure-jobs-worker.alive" });`
  and the worker's `healthcheck.test` in `docker/prod/docker-compose.yml` (and its integration compose file, if that
  runs the worker) to `["CMD", "node", "worker.mjs", "--health"]`; the interval, timeout, retries and start period stay.
  Or it re-runs `init --force` into a scratch folder and copies both.
- **`checkSharedHostCompose` in `@softure-ai/deploy/testing` (#600):** a guard over the production compose file of an
  app that runs next to another stack's Traefik (`init --edge`). It returns the violations as values (rule, service,
  message): the edge network joined only as `external: true` and never changed, no `ports` or `network_mode: host`,
  every Traefik router, middleware and service named `<prefix>` or `<prefix>-...`, `traefik.docker.network` on the
  edge network, and no router that serves a bypass path (`/mcp`, `/oauth`) behind an auth or allow-list middleware or
  without a `Host` matcher. New runtime dependency: `yaml`. Nothing changes for an app that does not call it. An app
  with its own guard replaces it:
  1. bump `@softure-ai/deploy` to this version;
  2. in its infrastructure test, call
     `checkSharedHostCompose(readFileSync("docker/prod/docker-compose.yml", "utf8"), { edgeNetwork, namePrefix, bypassPaths })`
     and expect `[]`;
  3. delete the hand-written guard and the tests that only cover the rules above (keep tests of anything app-specific).
  A loopback-published Postgres port fails `host-ports`: drop it and set `database.access` to `compose-exec`.
- **The worker service has a health check (#609):** `init` gave the `@softure-ai/jobs` worker
  `healthcheck: disable: true`, and Docker Compose fails `up --wait` on such a service ("container …-worker-1 has no
  healthcheck configured"), so every deploy of an app with a worker failed at the switch, and so did an integration
  stack started with `up --wait`. The service now checks that PID 1 (`node worker.mjs`) is alive. An app with a
  `worker` service replaces its `healthcheck` block in `docker/prod/docker-compose.yml`, and in its own integration
  compose file if that has one, with:

  ```yaml
  worker:
    healthcheck:
      test: ["CMD", "node", "-e", "process.kill(1, 0)"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 10s
  ```

  Or it re-runs `init --force` into a scratch folder and copies the `worker` service. Nothing else changes.

## 0.4.2

- **`cloudflare-ranges` reads a Traefik static config file (#560):** the hook `init --cdn=cloudflare` writes looked
  for `forwardedHeaders.trustedIPs` only in the compose file's flags, so an app with Traefik's static configuration in
  `traefik.yml` or `traefik.toml` got a false warning on every run. It now takes `--traefik-static-config <path>`
  (relative to the compose file's folder) and checks every `trustedIPs` list of that file instead (YAML block or flow
  lists, TOML arrays); a missing range is still a warning, and so is a file it cannot read or one without
  `trustedIPs`. An unknown argument fails the hook. Without the option nothing changes. An app that runs a forked
  hook for this reason:
  1. copies the hook again from `init --cdn=cloudflare` of this version (or applies the template's diff) to
     `docker/prod/hooks/cloudflare-ranges.sh`;
  2. adds the option to both hooks of `deploy.json`:
     `{ "name": "cloudflare-ranges", "run": ["bash", "hooks/cloudflare-ranges.sh", "--traefik-static-config", "traefik/traefik.yml"] }`
     and the same `run` for `cloudflare-ranges-daily` (the path is the app's own static config, relative to the
     compose file's folder, which the release ships to the server).
- **`maintain` test-restores its backup (#561):** a new `verify-backup` step of the generated `deploy.sh`. On the
  Sunday run by default it counts `database.rowCountTables` (less `excludeTableData`, whose rows the dump leaves out)
  right before the backup, restores the new dump with `pg_restore --exit-on-error` into the throwaway database
  `softure_verify_backup` of the same Postgres (as the `postgres` service's superuser, in both access modes), compares
  the restored counts (none may be lower) and drops the database again. A dump that does not restore or holds fewer
  rows fails the maintain run with `result|failed|verify-backup|<message>`. `deploy.json` takes
  `database.verifyBackup`: `"weekly"` (default), `"daily"` or `"never"`. `server-settings` writes `verify-backup` and
  `verify-tables` for the script; `verify-backup` is a built-in step name, so a hook can no longer take it.
- `row-counts --compare` fails with `row-counts: lost rows or tables: …` (it said "the deploy lost rows or tables").
- **Migration for #561 (an app with a database):** `deploy.sh` belongs to the app, so nothing changes until the app takes
  the new script:
  1. Bump `@softure-ai/deploy` to this version (the generated script pins the CLI it calls, and only this version's
     `server-settings` writes the verify files).
  2. Take the new `docker/server/deploy.sh`: `softure-deploy init --force` and keep the app's own edits, or copy from
     this version's `templates/docker/server/deploy.sh.tmpl` the `VERIFY_DATABASE` constant, the `verify_*` variables,
     the `drop_verify_database` line in `finish`, the two `verify_*` reads in `load_settings`, the functions from
     `count_rows` to `verify_backup` (`count_rows` now takes `--config=…` or `--tables=…` first, so the two calls in
     the deploy part change too) and the `backup`/`verify-backup` block of `maintain`.
  3. Optional: set `database.verifyBackup` in `deploy.json` (`"daily"` to see it run on the next maintain, `"never"`
     on a host without disk for a second copy of the database).
  4. The next release installs the script; check the Sunday maintain in `journalctl -t <name>-maintain` for
     `step|verify-backup|ok|<dump file>`.

## 0.4.1

- **`init --edge=<network>` (#516):** for an app that runs as a second compose project next to another stack's
  Traefik. init writes no Traefik service, no `traefik.yml` and no `letsencrypt` volume; the app joins the external
  network and its own, and is published with labels (router, `websecure`, resolver `letsencrypt`, security headers,
  the optional `www` redirect, all named after the app). The generated `deploy.sh` switches `app` alone and has no
  `traefik` step. Refused together with `--cdn` or `--acme-email`; with a database a warning names the Postgres
  loopback port both stacks would publish. Without `--edge` the files are the same as before, but for the next point.
- **The switch starts the worker (#516):** `deploy.sh` ran `compose up … traefik app`, which never started the
  `worker` service (nothing depends on it), so a release left the previous worker running. The switch now names
  `worker` for an app that has one. An app that ran `init` with the worker adds ` worker` to the `compose up` line of
  its `docker/server/deploy.sh` (after `traefik app`).
- **Health wait options (#516):** the deploy action takes `health-status` (the status that counts as up, default
  `200`; a redirect is not followed, so `302` passes a host behind a sign-in) and `health-headers` (masked
  `Name: value` lines sent with the health request only, e.g. a Cloudflare Access service token). Without them the
  wait is the same 200 check.

## 0.4.0

- **Breaking (#476): no whole secrets context.** CodeQL (`actions/excessive-secrets-exposure`) flags `toJSON(secrets)`
  and `secrets[<computed name>]`: either hands the runner every secret of the job, `github_token` and the deploy key
  included. `deploy-app.yml` no longer has either:
  - `secrets-from-environment: true` is refused by the check job, and the inputs `ssh-host-secret`, `ssh-user-secret`,
    `ssh-private-key-secret`, `ssh-known-hosts-secret` and `verify-env-secret` are removed (passing one fails the call
    as an unknown input). The verify job no longer runs in `environment`.
  - A caller with `secrets-from-environment` migrates as in 0.3.0 (the four steps below): `deploy: false` on the
    `deploy-app.yml` job and one job per environment that runs the deploy action. A caller that passes named secrets,
    or already runs the deploy action, changes nothing for this point.
- **The deploy action takes the app's secrets by name:** a new input `secret-names` lists the secrets the step's `env:`
  holds, so the caller writes one line per secret instead of `app-secrets: ${{ toJSON(secrets) }}`, and its own
  repository's CodeQL scan has nothing to flag. Only the listed names are read; an empty value counts as unset (the
  compose file's check names a required one). A name the runner owns (`PATH`, `HOME`, `CI`, `NODE_*`, `NPM_CONFIG_*`,
  `GITHUB_*`, `RUNNER_*`, `ACTIONS_*`, `INPUT_*`), one the render step sets itself, a repeat, or `secret-names` next to
  a non-empty `app-secrets` is refused by name, never by value. `app-secrets` keeps working unchanged.
  To move an app from `app-secrets: ${{ toJSON(secrets) }}` (optional, recommended):
  1. In each environment job's deploy action step, add `env:` with one line per secret the compose file uses
     (`${NAME:?}` and the optional `${NAME:-…}` ones the app sets): `NAME: ${{ secrets.NAME }}`.
  2. Replace `app-secrets: ${{ toJSON(secrets) }}` with `secret-names:` listing the same names, separated by spaces or
     newlines. Keep `app-vars: ${{ toJSON(vars) }}` (variables, not secrets).
  3. Pin the action and `deploy-app.yml` to the commit of the release tag carrying this change.
  [`examples/deploy-environments.yml`](examples/deploy-environments.yml) shows the result.
- **`init`'s caller passes secrets by name (#486):** the `.github/workflows/deploy.yml` that `softure-deploy init`
  writes, and [`examples/deploy.yml`](examples/deploy.yml), no longer pass `app-secrets: ${{ toJSON(secrets) }}` to
  `deploy-app.yml`. They call it as `build` with `deploy: false`, then a job `deploy` with `environment: production`
  runs the deploy action, each secret the compose file requires in the step's `env:` and `secret-names` (init fills in
  the names from the compose file it writes). The secrets may live in the repository or in the `production`
  environment. An app that ran `init` before keeps working unchanged; to clear the CodeQL alert in its repository
  (optional, recommended), replace the `deploy` job of its `.github/workflows/deploy.yml`:
  1. Rename the job `deploy` to `build`, add `deploy: false` under its `with:`, and delete its whole `secrets:` block
     (with `deploy: false` the check job refuses every secret). Move `app-vars` out of `with:` (step 3).
  2. Add a job `deploy` with `needs: build`, `runs-on: ubuntu-latest`, `timeout-minutes: 30`,
     `environment: production`, `concurrency: { group: deploy-production, cancel-in-progress: false }` and
     `permissions: { contents: read, packages: read }`.
  3. Give it one step, `uses: SOFTURE/AI/.github/actions/deploy@<the same ref as deploy-app.yml>`, with `env:` holding
     `NAME: ${{ secrets.NAME }}` for every name of the old `app-secrets` comment ("reach .env.prod: …"), and `with:`
     `release: ${{ needs.build.outputs.release }}`, `image: ${{ needs.build.outputs.image }}`,
     `digest: ${{ needs.build.outputs.digest }}`, `ssh-host`, `ssh-user`, `ssh-private-key`, `ssh-known-hosts`,
     `origin-address` and `verify-env` from the same secrets as before, `secret-names:` listing the `env:` names, and
     `app-vars: ${{ toJSON(vars) }}`.
  4. A `report` job that called `deploy-report.yml` with `needs: deploy` takes `needs: [build, deploy]` and
     `if: ${{ always() && needs.build.result == 'success' }}`.
  Running `init --force` on a scratch copy of the app prints the same file with the app's names filled in;
  [`examples/deploy.yml`](examples/deploy.yml) is the result for two secrets.

- `init` adds a job worker for an app that depends on `@softure-ai/jobs` (and `@softure-ai/db`), issue #471:
  `scripts/worker.ts` (calls `runJobWorkerProcess` with the app's handlers), its esbuild bundle `worker.mjs` in the
  image, and a `worker` service in `docker/prod/docker-compose.yml` from the same image (`node worker.mjs`, the app's
  environment, health check off, `stop_grace_period: 30s`, after `migrate`). Apps without `@softure-ai/jobs` get
  byte-identical files. An app that already ran `init` adds the three parts by hand or re-runs `init --force` on those
  files (see the README, `softure-deploy init`).
- **Pinned callers say they are pinned (#473):** with `init --workflows-ref=<sha>`, the header comments of the
  generated `deploy.yml`, `checks.yml`, `release.yml` and `release-notes.yml` say the callers are pinned to that commit
  and are moved together on an upgrade; the "pin a commit SHA" advice and the `git ls-remote` hint are written only
  when they call `master`. Only comments change: an app that already ran `init` may keep or hand-edit its comments.

## 0.3.0

- **Per-environment secrets (#468):** the composite action `SOFTURE/AI/.github/actions/deploy` renders `.env.prod`,
  sends the release over SSH, verifies it and writes `deploy-report` inside the caller's own job, so a job with
  `environment: <name>` deploys with that environment's `secrets` and `vars`. This works for an app outside the SOFTURE
  organization too, where `secrets: inherit` passes nothing to `deploy-app.yml`, and for several environments
  (production and dev) from one build. `deploy-app.yml` takes `deploy` (default `true`): `false` checks and builds
  only and returns the checked values as the workflow output `release`, which the action reads. With `deploy: false`
  the check job refuses secrets and the deploy-only inputs. `deploy-app.yml`'s own deploy and verify jobs now run the
  same action from the workflow's commit; callers that keep one `uses:` line change nothing.
  [`examples/deploy-environments.yml`](examples/deploy-environments.yml) is the caller to copy. To migrate an app:
  1. In the deploy caller, add `deploy: false` to the `deploy-app.yml` job and drop its `secrets:` (or
     `secrets: inherit`), `secrets-from-environment`, the `ssh-*-secret` inputs, `origin-address(-var)` and
     `verify-env-secret`.
  2. Add one job per environment: `needs: <build job>`, `environment: <name>`, `permissions: { contents: read,
     packages: read }`, a `concurrency` group per environment, and the step
     `uses: SOFTURE/AI/.github/actions/deploy@<sha>` with `release: ${{ needs.<build job>.outputs.release }}`, the
     `DEPLOY_SSH_*` secrets, `app-secrets: ${{ toJSON(secrets) }}`, `app-vars: ${{ toJSON(vars) }}` and, where used,
     `origin-address` and `verify-env`. A second environment also sets `app-url`, `environment` and `report: false`.
  3. Move the runtime secrets and `DEPLOY_SSH_*` into each GitHub environment (switches into its variables).
  4. Point `deploy-report.yml`'s job at `needs: [<build job>, <reporting environment job>]` with
     `if: ${{ always() && needs.<build job>.result == 'success' }}`.
  Pin `deploy-app.yml` and the action to the same commit, the one of the tag `deploy@0.3.0`.

## 0.2.2

- `release-notes --roadmap=auto` finds the roadmap itself (issue #465): `context/foundation/roadmap.md` while it exists,
  else the roadmaps archived to `context/foundation/archive/<YYYY-MM-DD>[-N]-roadmap.md` since the previous tag, read at
  `--to`. Finding none is no table and exit 0, so a release made after the roadmap was closed no longer fails with
  ENOENT. An explicit path behaves as before. A release workflow can pass `--roadmap=auto` and drop its own fallback.

## 0.2.1

- **Caller change (#462):** `deploy-integration.yml`'s `test` job takes `packages: read`, so a `registry-token` set from
  the caller's `GITHUB_TOKEN` pulls a private prebuilt image instead of failing with `manifest unknown`. Every caller
  must grant `packages: read` (next to `contents: write`), or GitHub refuses the run at start; `examples/integration.yml`
  does. The workflow is called at `master`, so this applies from the merge, before any npm release.

## 0.2.0

- **Breaking (#446):** the `pl` dictionary is gone; release notes and the release report are English only
  (`--locale=en`, `deployMessages.en`), and `deploy-report.yml` takes `locale: en` only.
- `deploy-release-notes.yml` takes `keep-report` (boolean, default `false`): it writes `body`, then the current body from
  its first `<!-- softure-deploy:` marker on, unchanged, so editing the owner's text no longer wipes the sections
  `release-notes` and `report` wrote (issue #436). A body carrying a marker is refused; a release without one is
  replaced whole. The `release-notes.yml` caller (`init`, `examples/`) exposes `keep-report` with default `true`; an
  app that ran `init` before copies it from `examples/release-notes.yml`.
- A verify route takes `warnOn: { status: [...] }`: a response with a listed status is a `WARN` row and the route's
  other checks are skipped, while every other mismatch keeps the route's severity (issue #434). An optional resource
  such as the Web Bot Auth key directory warns while it is a 404 and fails on a login page or a 500. A listed status
  on a `forEach` source warns the same way; the schema refuses an empty or repeated list and the route's own status.
- A verify header check takes `{ "startsWith": "<text>" }` next to the string, list and `null` forms: the value must
  begin with the text, case-insensitive, so a Web Bot Auth `signature-input` that must start with
  `binding0=("@authority";req)` no longer passes when that text appears later (issue #441). It may also be an item of
  a list. A plain string keeps its substring meaning, so existing configs do not change.

## 0.1.11

- `softure-deploy run --local <script> [args]` runs the ops script an image bundles (`scripts/ops/<name>.ts`) on this
  machine with `tsx`, against `DATABASE_URL` (`--url-env=<NAME>` for another variable), so an app's wrapper that
  switched between production and a local database is an npm alias (issue #405). The script keeps its own dry run
  and `--commit`; the CLI names the target `host/database` on stderr first. `--scripts-dir` and `--tsx` override the
  folder and the runner. The remote `run --host=…` is unchanged.
- `@softure-ai/deploy/testing` exports `installFakeSsh({ reply })`: a fake `ssh` first on `PATH` that records each
  call's arguments and stdin and answers with scripted output and status, for testing operator wrappers without a
  server (issue #405).
- `softure-deploy help` lists `run` and `report`.
- `deploy-release-checks.yml`, a reusable workflow for the checks every app kept in its own YAML (issue #406):
  `prepare` (the tag matches `tag-pattern`, `vYYYY.MM.DD[-N]` by default, and its commit is on the release branch;
  without a tag, the caller's commit), `static` (`static-command`) and `unit` split into `shards` jobs with
  `SHARD_INDEX` and `SHARD_COUNT`; it reads the repository only. `deploy-release-image.yml` then builds the checked
  commit, pushes `<image>:sha-<sha>` and outputs `prebuilt-image` by digest for `deploy-app.yml`. README "Release
  checks" shows the `checks` and `image` jobs ahead of a deploy.
- `deploy-release-notes.yml` replaces one release's body from a `workflow_dispatch` (`tag`, `body`), for an agent that
  cannot edit releases through the API (issue #406).
- `init` writes two more callers, pinned by `--workflows-ref` like the others: `.github/workflows/checks.yml` (`static`
  on pull requests, the unit tests on demand or with the `run-tests` label, `next typegen` before `tsc`) and
  `.github/workflows/release-notes.yml`. An app that ran `init` before copies them from `examples/`.

## 0.1.10

- `init --report-role=<role>` (answer `reportRole`) names the Postgres role `deploy.sh`'s `report` reads as
  (`REPORT_ROLE`), for an app whose compose file takes the whole `DATABASE_URL` from a variable or whose app role has
  another name (issue #383). It is checked like the role init reads from a kept compose file and wins over it and over
  `softure_app`, also with `--force`. Without it nothing changes; the warning for an unreadable role now names the
  flag.

## 0.1.9

- `deploy-integration.yml` takes three inputs an app's own integration workflow had (issue #368):
  - `artifact-paths`: paths or globs inside the repository, one per line, uploaded as the `integration-failure`
    artifact (kept 7 days) when the suite is red or the job fails, e.g. Playwright's `test-results/**`.
  - `sparse-checkout`: gitignore-style patterns (cone mode off) for the test and record jobs' checkouts; empty, the
    default, checks out the whole tree as before.
  - `node-cache`: `npm` (default) or `yarn` caches the package manager's downloads through `setup-node`; `""` turns
    it off. The cache needs the lockfile in the repository: a caller without `package-lock.json` sets `node-cache: ""`.

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
- `integration run`, `lookup` and `record` print one `flaky: <test>` line per test that passed only on a retry, after the
  `new-red` lines (issue #308). The note stores them as `flaky`, a key written only when there are some, so the 0.1.7
  CLI still reads every note without flaky tests.
- `integration record --results=<file> [--format=junit|playwright-json]` also reads Playwright's JSON reporter output
  (`.json` is read as Playwright when `--format` is left out); `--junit=<file>` works as before. JUnit names flaky
  tests only from Surefire's `<flakyFailure>` and `<flakyError>`. `--fail-on-flaky` stores red and exits 1 when the
  report names a flaky test.
- `--notes-ref=refs/notes/<name>` (`run`, `lookup`, `record`) and `--ref-prefix=<prefix>/` (`run`, `record`) keep an
  app's existing notes ref and branch prefix, so its main-branch baseline and `new-red` carry over.
- `deploy-integration.yml` takes `results-report` and `results-format`, `notes-ref`, `ref-prefix`, and a prebuilt-image
  mode for a release workflow: `image` (`<registry/name>@sha256:<digest>`, pulled before the app's code runs, with the
  optional `registry-token` secret), `expected-origins` and `fail-on-flaky`, handed to the set-up and suite commands as
  `INTEGRATION_IMAGE`, `INTEGRATION_EXPECTED_ORIGINS` and `INTEGRATION_FAIL_ON_FLAKY`; a tag push is accepted with
  `image`. The uploaded report's artifact is now `integration-results`.
- `init --cdn=cloudflare` locks the origin to Cloudflare (issue #310): `docker/server/cloudflare-only.sh` with its
  `.service` and `.path` units, which root installs once, lets only Cloudflare's ranges reach ports 80 and 443
  (iptables `DOCKER-USER`, IPv6 through `DOCKER-USER` or `INPUT`); `docker/prod/hooks/cloudflare-ranges.sh`, run as the
  `post-up` hook `cloudflare-ranges` and the `maintain` hook `cloudflare-ranges-daily`, keeps the ranges file current;
  Traefik keeps forwarded headers from Cloudflare's ranges only (`forwardedHeaders.trustedIPs`). init prints the two
  steps it leaves to the owner (root's install, the `DEPLOY_ORIGIN_IP` secret for `verify --origin`).
- init's `Dockerfile` bundles `migrate.mjs` and the ops scripts with `--alias:server-only=./.esbuild/empty.mjs` and a
  `createRequire` banner, so a `server-only` data layer and CJS dependencies run in the ESM bundles. An app generated
  before adds both flags and the `.esbuild/empty.mjs` line (README, "Bundled for plain Node").
- init writes `docker/prod/hooks/lib.sh` for the app's hooks: `fail`, `compose`, `env_value` and `require_min_length`.
- `env render --min-length=NAME=N` (repeatable) refuses a value shorter than N characters, naming the variable only;
  `deploy-app.yml` passes them from its new `secret-min-lengths` input.
- `deploy-app.yml` hands variables to the verify step (issue #357), e.g. the key a `webBotAuth` route signs with: the
  optional secret `verify-env` (a JSON object of text values by name) or, with `secrets-from-environment`, the input
  `verify-env-secret` (an environment secret holding the same object; the verify job then runs in `environment`, which
  asks again when that environment has required reviewers, and reads only that secret). Each value is masked and reaches `softure-deploy verify` only. A name the verify step or
  the runner sets itself is refused (`verify-env` by the check job, the environment secret by the verify step), as are
  each form on the other path and both with an empty `deploy-config`.
  Without them nothing changes. The example caller and the one `init` writes pass `verify-env` from the repository
  secret `DEPLOY_VERIFY_ENV` (unset passes nothing).

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
