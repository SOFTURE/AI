# Research: deploy-environment-secrets

Read on master `8d8b8e5`. Sources: `.github/workflows/deploy-app.yml`, `.github/workflows/e2e-deploy.yml`,
`tools/deploy/examples/deploy.yml`, `tools/deploy/README.md` (Deploy workflow), `tests/repo/deploy-workflows.test.ts`,
`tools/deploy/tests/release-guards.test.ts`, and GitHub's documentation on reusable workflows (issue #296 quotes it).

## Today

- **Secrets.** `on.workflow_call.secrets` declares `ssh-host`, `ssh-user`, `ssh-private-key`, `ssh-known-hosts`,
  `app-secrets` (all `required: true`) and `origin-address` (optional). The example caller passes each by name from
  repository secrets and `app-secrets: ${{ toJSON(secrets) }}`.
- **Where they are read.** `check` reads `secrets.origin-address` (validated, refused without `deploy-config`).
  `deploy` (the only job with `environment: ${{ inputs.environment }}`) reads `secrets.app-secrets` in the render step
  and the four SSH secrets in the send step (each `inputs.e2e && steps.e2e-server.outputs.* || secrets.*`). `verify`
  (no environment) reads `secrets.origin-address` for `--origin`.
- **Render.** A node script parses `APP_SECRETS` and `APP_VARS` as JSON objects, refuses `PATH|HOME|NODE_*|NPM_CONFIG_*`
  names, and runs `env render`, which writes only the compose file's required names. The e2e passes one extra secret
  (`UNUSED_SECRET`) and asserts it is not in `.env.prod`.

## GitHub's rules that matter

- A job with `uses:` cannot set `environment:`, so the caller's `secrets:` expressions see repository and
  organization secrets only.
- In the called workflow, a job with `environment:` sees that environment's secrets in its `secrets` context, over a
  secret of the same name passed by the caller. With `secrets: inherit` the context holds every secret of the caller
  by its own name, plus `github_token`.
- Environment secret names allow letters, digits and `_` only, so none can carry `app-secrets` or `ssh-host`.
- A job output that contains a secret is not passed to other jobs, so the deploy job cannot hand an environment
  secret to `verify`.
- Contexts can be indexed by an expression: `secrets[inputs.name]`.

## Tests that pin today's shape

- `tests/repo/deploy-workflows.test.ts`: the send step's `env` strings, the verify step's `ORIGIN_ADDRESS`, the example
  caller passes every declared secret, the e2e caller passes every required secret.
- `tools/deploy/tests/release-guards.test.ts`: runs the check step and the render step (stub CLI).
