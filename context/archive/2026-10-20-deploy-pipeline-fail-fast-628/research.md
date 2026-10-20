---
change_id: deploy-pipeline-fail-fast-628
---

# Research: fail fast across a release pipeline (issue #628)

## Where it happens

- `.github/workflows/deploy-release-checks.yml`: `prepare` → `static` and `unit` (matrix of shards,
  `strategy.fail-fast: false`). `contents: read` on every job.
- `.github/workflows/deploy-release-image.yml`: one `build` job, `ref` must be a full commit SHA (README's example
  takes it from the checks' `sha`, so the image waits for every shard).
- `.github/workflows/deploy-app.yml`: `check` (inputs, tag-on-branch guard, the `release` JSON) → `build` → `deploy`
  → `verify` → `summary`. With `deploy: false` the caller's own job runs `.github/actions/deploy` with the secrets.
- `.github/actions/deploy/action.yml`: read the release → checkout server files → setup-node → render `.env.prod`
  (`softure-deploy env render`, names from the compose file, min lengths, build-args agreement) → pack → send (host
  and user format checked only here, key and known_hosts written and used by `ssh`) → health → verify → report →
  cleanup.
- Tests: `tests/repo/deploy-workflows.test.ts` (shape of every `deploy-*.yml`, step scripts run under bash).
- Examples: `tools/deploy/examples/*.yml`; `init` generates `deploy.yml`, `checks.yml`, `release.yml`,
  `release-notes.yml` (tests compare them with the examples). README "Release checks", "Before a deploy".

## Facts that shape the fix

- A job that `needs:` a reusable-workflow call waits for every job inside it, so one watcher over `[checks, image]`
  fires only after the slowest part; one watcher per part fires as soon as that part ends.
- `failure()` in a job's `if` is true when a job it needs, or any ancestor, failed; the watcher is skipped otherwise.
- A job inside a called workflow may hold at most the caller's permissions, checked when the run starts, whatever its
  `if`. Cancelling a run needs `actions: write` (`POST /repos/{owner}/{repo}/actions/runs/{run_id}/cancel`), so it
  cannot live in `deploy-release-checks.yml` (pull request callers grant `contents: read`). A separate reusable
  workflow, called only by the watcher jobs that grant `actions: write`, keeps it out of every other job.
  `github.run_id` inside a called workflow is the caller's run.
- Inside the checks, a red `static` cannot stop the shards without that permission. Splitting the deploy caller's
  checks into two calls (`unit: false` and `static: false`) gives each part its own watcher; `strategy.fail-fast`
  (an expression may set it) stops the other shards when one is red.
- The `release` object of `deploy-app.yml` comes from the `check` job, which needs no image except to validate
  `prebuilt-image`; the tag's commit is resolved in the same job (`git rev-parse "$TAG^{commit}"`). A check-only
  call can therefore hand the release and the commit out within a minute, so the image can be built in parallel with
  the checks.
- `ssh-keygen -y -P '' -f <key>` fails on a key that does not parse or has a passphrase; `ssh-keygen -F <host> -f
  <file>` (`[host]:port` off port 22) finds a known_hosts entry, hashed or not. The e2e server writes
  `[127.0.0.1]:<port>`, which `-F "[127.0.0.1]:<port>"` matches. No connection is made.
- `env render` has no dry-run flag; rendering into the action's checkout and deleting the file (the cleanup step
  already removes `.softure-ai-release/.env.prod`) checks the required names, the min lengths and the build-args
  agreement with the CLI the deploy uses.
- An environment with required reviewers asks again for every job that declares it; the preflight job is one more.
