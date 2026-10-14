# Research: deploy-named-secrets

## 1. What the query flags (github/codeql, `actions/ql/src/Security/CWE-312/ExcessiveSecretsExposure.ql`)

An expression is flagged when either:
- a `toJSON(...)` argument starts with `secrets` (so `toJSON(secrets)` and also `toJSON(secrets.NAME)`), or
- the expression starts with `secrets[` and the index is not a quoted literal (`secrets[inputs.x]`).

So a hand-built JSON object (`{"A": ${{ toJSON(secrets.A) }}}`) is flagged too. Plain `secrets.NAME`
references are not.

## 2. Where this repository matches

- `deploy-app.yml` deploy job: `app-secrets: ${{ inputs.secrets-from-environment && toJSON(secrets) || ... }}`
  (alert #47).
- `deploy-app.yml`: `${{ secrets[inputs.ssh-*-secret] == '' && ... }}` in the SSH check step (starts with
  `secrets[`), and `secrets[inputs.ssh-*-secret]` / `secrets[inputs.verify-env-secret]` inside longer
  expressions. All exist only for `secrets-from-environment`.
- `tools/deploy/examples/deploy-environments.yml` and `examples/deploy.yml`, the init template
  `deploy.yml.tmpl`: `toJSON(secrets)` (not scanned here, but copied into apps, which scan them).

## 3. Why `secrets-from-environment` cannot be made named

A reusable workflow learns the secret names from the compose file at run time; expressions cannot loop,
so reading environment secrets by those names needs either the whole context or a dynamic
`secrets[name]` per slot (flagged as well, and a fixed slot count). The mode was added for an app
outside the organization (#296), where `secrets: inherit` passes nothing (#468), so it never served its
purpose; 0.3.0's migration already tells callers to drop it in favour of the deploy action.

## 4. A named path in the action

A composite action's steps see the `env:` of the step that uses it (actions/runner ADR 0549: env flows
from the parent to nested steps). So the caller writes `env: { DATABASE_URL: ${{ secrets.DATABASE_URL }} }`
on the action step (plain references, not flagged) and lists the names in a new input `secret-names`;
the render step reads exactly those variables. An explicit list keeps runner variables (`GITHUB_*`,
`RUNNER_*`, `CI`) from being read as secrets. Names the render step sets itself, or the runner reserves,
are refused.

## 5. Callers of the reusable workflow by name

`deploy-app.yml`'s named path still takes one `app-secrets` JSON secret, which the caller builds; with
`toJSON(secrets)` that is an alert in the caller's repository, not here. Turning `init`'s template into
the action path is a separate change (follow-up issue).

## 6. Tests touched

`tools/deploy/tests/environment-secrets.test.ts` (the flag's check rules, SSH check step, render step),
`verify-env.test.ts` (`verify-env-secret`), `tests/repo/deploy-workflows.test.ts` (inputs, example
caller).
