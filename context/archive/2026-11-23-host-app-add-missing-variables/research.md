# Research: host-app-add-missing-variables

## What exists

- `tools/host/src/cli/app-add-command.ts`: `missing = findRequiredNames(compose)` minus `existing` (Environment secret
  names from `prepareEnvironment`) minus `plan.secrets`. `plan.variables` (`APP_HOST`, `EDGE_NETWORK`) is not
  subtracted, nor are existing variables.
- `tools/host/src/github/gh.ts`: `listSecretNames` runs `gh secret list --env production --repo <repo> --json name`;
  there is no variable listing yet. `gh variable list` takes `--repo`, `--env` and `--json name`.
- `tools/deploy/templates/.github/workflows/deploy.yml.tmpl`: the deploy step passes `app-vars: ${{ toJSON(vars) }}`
  next to the secrets, and `env render --from-json-env` merges both, so repository and Environment variables
  satisfy a required name.
- `prepareEnvironment` in `--check` mode returns early for an Environment that does not exist, so nothing under it is
  read; the test "changes nothing with --check, and reads nothing under an Environment that does not exist" pins it.

## Options

- Subtract variables, one missing list (chosen): a missing name has no kind yet; the operator decides whether it is a
  secret or a variable, so the line says it can be either.
- Two lists (the issue's proposal): would need a kind for a name that is set nowhere; nothing in the compose file
  tells a secret from a variable.
