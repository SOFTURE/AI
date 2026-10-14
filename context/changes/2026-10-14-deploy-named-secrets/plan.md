# Plan: deploy-named-secrets

## Goal

No `toJSON(secrets)` and no dynamic `secrets[...]` left in `deploy-app.yml`; the deploy action takes the
app's secrets by name from its step's `env:`; the environment example uses that path. Apps on the
action with `app-secrets` keep working.

## Phase 1: The action reads secrets by name

1. `.github/actions/deploy/action.yml`: input `secret-names` (names separated by spaces or newlines,
   default empty). The render step reads each listed name from its environment (the caller's step
   `env:`), refuses a name that is not one, repeats, is reserved for the runner (`PATH`, `HOME`,
   `NODE_*`, `NPM_CONFIG_*`, `GITHUB_*`, `RUNNER_*`, `ACTIONS_*`, `INPUT_*`, `CI`) or is a variable the
   step sets itself, and refuses `secret-names` together with a non-empty `app-secrets`. An empty value
   counts as unset (the compose file's check names it). `app-vars` still win over a secret.
2. Tests in `tools/deploy/tests/environment-secrets.test.ts` run the render step with the real CLI:
   named values land in `.env.prod`, an unlisted variable of the environment does not, each refusal
   names the input and never a value.

## Phase 2: `deploy-app.yml` without the whole secrets context

1. `secrets-from-environment: true` is refused by the check job with the migration hint (input kept so
   the error is ours, not GitHub's "invalid input"); inputs `ssh-*-secret` and `verify-env-secret` go.
2. The deploy job's SSH check step goes; send passes `secrets.ssh-*` / `secrets.app-secrets` and
   `secrets-context: false`; verify job takes `secrets.verify-env` and leaves the environment.
3. Tests: drop the flag's acceptance tests, add the refusal; repository test asserts no `toJSON(secrets)`
   and no `secrets[` in any workflow under `.github/` (the CodeQL query's two shapes).

## Phase 3: Examples, docs, release

`examples/deploy-environments.yml` passes `env:` + `secret-names`; README sections on secrets and the
environment path; CHANGELOG 0.4.0 (breaking: the flag) with the migration; version bump with the
workflow default `deploy-cli-version`; follow-up issue for `init`'s template (`toJSON(secrets)` in the
app's own caller).

## Decisions (auto)

- D1: remove `secrets-from-environment` instead of dismissing the alert: it cannot be made named
  (research §3), it never served the cross-owner app it was built for, and 0.3.0 already migrates
  callers off it. Breaking, so a minor bump before 1.0 (0.4.0).
- D2: an explicit `secret-names` list over reading the compose names from the environment: no runner
  variable is ever taken for a secret, and the CLI does not change.
- D3: `app-secrets` JSON stays in the action and the workflow: apps already migrated change nothing.
- D4: `init`'s single-`uses:` template is a follow-up issue, not this change (research §5).

## Progress

- [ ] Phase 1
- [ ] Phase 2
- [ ] Phase 3
