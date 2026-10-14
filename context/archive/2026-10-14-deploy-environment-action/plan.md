# Plan: deploy-environment-action

## Goal

`deploy-app.yml` callers keep working; an app outside the organization deploys each environment with
that environment's secrets through `SOFTURE/AI/.github/actions/deploy`, and both paths run the same
steps.

## Phase 1: The action and the workflow on it

1. `.github/actions/deploy/action.yml`: inputs `release` (JSON), `send`, `verify`, `report`,
   `ssh-host`, `ssh-user`, `ssh-private-key`, `ssh-known-hosts`, `app-secrets`, `secrets-context`,
   `app-vars`, `origin-address`, `verify-env`, `verify-env-name`, `image`, `digest`, `deploy-cli`,
   `ca-file`, results for the report. Steps: read `release`; checkout server files into
   `.softure-ai-release/`; setup-node; render; pack; send; keep lines; health wait; config verify;
   report; cleanup. Every value through `env:`.
2. `deploy-app.yml`: check job writes `release`; input `deploy`; deploy and verify jobs self-check-out
   (`job.workflow_repository@job.workflow_sha`) and run the action; workflow output `release`;
   `deploy: false` skips deploy, verify and summary and refuses the action's secrets.
3. `e2e-deploy.yml` paths include `.github/actions/**`.

Done when: actionlint clean, typecheck, lint, tests green.

## Phase 2: Tests

Move the step lookups of the five test files and `deploy-workflows.test.ts` to the action; new tests:
`release` JSON from the check job, `deploy: false` refusals, the example environment caller passes only
declared inputs, the action never interpolates inputs into a script and has no `secrets` context.

## Phase 3: Docs, example, release prep

`tools/deploy/README.md` (section "Environments: the deploy action"), `examples/deploy-environments.yml`,
CHANGELOG, version minor bump to 0.3.0 with the workflow defaults, issue #468 closing comment.

## Decisions (auto)

- D1: composite action over vendoring the workflow into the app: one pinned SHA, no copy to drift.
- D2: `release` JSON instead of repeating every input in the caller: the check job stays the only
  validator; the action re-checks the SSH host and user as today.
- D3: `secrets-from-environment` stays for same-organization callers; no deprecation in this change.
- D4: minor bump (0.3.0): new public surface (the action, `deploy`, `release`), nothing removed.

## Progress

- [x] 1 action and workflow (91d60e9)
- [x] 2 tests (4c27f56)
- [x] 3 docs, example, release prep (5e75176); gates: typecheck, lint, npm test (6901 passed), build, actionlint green
