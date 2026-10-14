# Research: deploy-environment-action

## 1. What GitHub allows (docs, 2026-10-14)

- `secrets: inherit` works only between workflows of the same organization or enterprise.
- Environment secrets in a reusable workflow: "set `environment` on the job in the reusable workflow.
  The caller workflow must still pass the secret." The caller's `uses:` job cannot set `environment`,
  so its `secrets:` hold repository and organization secrets only.
- A normal job with `environment:` sees that environment's secrets in `secrets` and its variables in
  `vars` (contexts reference: "configuration variables at the organization, repository, and
  environment levels").
- A composite action runs inside the caller's job: it reads only its `inputs`, and the caller fills
  them from its own `secrets` and `vars`. Actions of a public repository are usable from any owner,
  pinned like workflows (`SOFTURE/AI/.github/actions/<name>@<sha>`).
- `job.workflow_repository` and `job.workflow_sha` give a reusable workflow its own repository and
  commit (github.com only), so its jobs can check themselves out and run a local action from that
  checkout: one implementation for both entry points.

## 2. What reads secrets in `deploy-app.yml` 0.2.2

- `check`: presence of the named secrets, `origin-address`, `verify-env` validation.
- `deploy`: "Check the environment's SSH secrets" (`secrets[...]`), "Render .env.prod" (`app-secrets` or
  `toJSON(secrets)`), "Send the release to the server" (four SSH values). Also: checkout of the server
  files, setup-node, "Pack the release" (registry token `github.token`), "Keep the server's step
  lines", cleanup; e2e-only steps around them.
- `verify`: health wait, config checkout, "Verify the routes in deploy.json" (`origin-address`,
  `verify-env` or `secrets[verify-env-secret]`).
- `summary`: no secrets; job results, image, digest, server lines into `deploy-report`.

## 3. Shape chosen

- New composite action `.github/actions/deploy/action.yml` with phases `send`, `verify`, `report`
  (booleans): render, pack, send and server lines; health wait and route verify; the
  `deploy-report` artifact. Inputs: the release values as one JSON (`release`, written by the check
  job), the four SSH values, `app-secrets`, `app-vars`, `origin-address`, `verify-env`, and the
  report's facts (`image`, `digest`, results). `release` keeps the check job the single validator.
- `deploy-app.yml`: new output `release` (the check job's validated values as JSON) and input
  `deploy` (default `true`); `deploy: false` runs check and build only and refuses the secrets and
  inputs that belong to the action. Its `deploy` and `verify` jobs check out the workflow's own commit
  and run the action (`send` / `verify`), passing the values they read as today; `summary` stays a
  job (it must run when `deploy` never started) and keeps its script.
- Caller with environments (`examples/deploy-environments.yml`): job `build` calls `deploy-app.yml`
  with `deploy: false`; one job per environment declares `environment:` and runs the action with
  `secrets.*`, `toJSON(secrets)`, `toJSON(vars)`.

## 4. Tests that read the moved steps

`tests/repo/deploy-workflows.test.ts` (deploy, verify job blocks), `tools/deploy/tests/`
`environment-secrets`, `release-guards`, `server-files`, `e2e-scripts`, `verify-env`: they find
steps by name in `jobs.deploy` / `jobs.verify`; they move to the action's `runs.steps`, with the env
expressions now `inputs.*` / `steps.release.outputs.*`.

## 5. Risks

- The app checkout and the action's own checkout share the workspace: the action checks the app's
  server files out into `.softure-ai-release/` and runs there, so the workflow's self-checkout in
  `.softure-ai-deploy/` survives.
- Two environments in one run would both upload `deploy-report`: input `report` lets the second skip.
