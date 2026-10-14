# Research: deploy-init-named-secrets

## 1. Where the whole secrets context is still passed

- `tools/deploy/templates/.github/workflows/deploy.yml.tmpl`: one job `deploy` with `uses: deploy-app.yml` and
  `secrets.app-secrets: ${{ toJSON(secrets) }}`. Its comment already names the compose file's required names
  (`{{secretNames}}`, filled by `planInitFiles` from the rendered compose file).
- `tools/deploy/examples/deploy.yml`: the same single `uses:` form plus a `report` job (`deploy-report.yml`).
- `.github/workflows/e2e-deploy.yml` passes `app-secrets` as a literal JSON object (no secrets context): out of scope.

## 2. Why the single `uses:` form cannot be fixed in place

A reusable workflow takes secrets one by one (`secrets: <name>: ...`). `deploy-app.yml` takes the app's runtime
secrets as one JSON secret, `app-secrets`. Building it as `toJSON(secrets.NAME)` or a `format()` of named secrets
still matches the CodeQL query (issue #486). `secrets: inherit` passes nothing to a workflow of another owner
(an app outside the SOFTURE organization), and a job with `uses:` cannot name an environment.

## 3. The form without it (on master since #476)

`examples/deploy-environments.yml`: a `build` job calls `deploy-app.yml` with `deploy: false` (checks, tag branch,
image build; no secrets), then a job with `environment:` runs `SOFTURE/AI/.github/actions/deploy` with
`release`, `image`, `digest` from the build job's outputs, the SSH secrets, `env:` holding each app secret by
name and `secret-names` listing them. `tests/repo/deploy-workflows.test.ts` checks that shape for the example.
The action uploads the `deploy-report` artifact itself (`report: true` default), so `deploy-report.yml` works
after it as after the single form.

## 4. Inputs that move

| Single form (deploy-app.yml) | Two-job form |
| --- | --- |
| `with.tag`, `app-url`, `image`, `health-path`, `environment`, `build-args`, `prebuilt-image` | stay on `build` (deploy-app.yml checks them; `release` output carries them) |
| `with.app-vars` | action `app-vars` |
| `secrets.ssh-*` | action `ssh-*` from `secrets.DEPLOY_SSH_*` |
| `secrets.origin-address` | action `origin-address` (`secrets.DEPLOY_ORIGIN_IP` kept: init's `next` line names that secret) |
| `secrets.verify-env` | action `verify-env` |
| `secrets.app-secrets` | step `env:` + `secret-names` |

With `deploy: false` the check job refuses every secret and `origin-address`, `origin-address-var`, `e2e`, so
none of them stays on `build`.

## 5. Init and the required names

`planInitFiles` already parses the rendered compose file for `${NAME:?}` (`findRequiredNames`) and fills
`secretNames`. The same list gives the step's `env:` lines and `secret-names`. With no required name (no
database, no `--env`), the step has neither `env:` nor `secret-names`.

## 6. Overlap with open PRs

PR #480 changes only the header comment block of `deploy.yml.tmpl` (lines 1-8) and adds `workflowsPinned` to
`buildValues`. PR #482 does not touch the caller template. Keeping the edits below the header limits the
conflict to adjacent lines in `generate.ts` and the CHANGELOG's Unreleased section.
