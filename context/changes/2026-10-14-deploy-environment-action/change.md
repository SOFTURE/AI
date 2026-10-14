---
change_id: deploy-environment-action
title: "deploy: environment-scoped secrets for callers outside the organization, through a deploy action run in the caller's job (issue #468)"
status: active
roadmap_item: null
issue: 468
branch: claude/project-thread-rqwqls
created: 2026-10-14
updated: 2026-10-14
---

## Intent

An app outside the SOFTURE organization deploys with each environment's own secrets and variables
(production, dev, staging): the steps that read secrets run in a job the app owns and that declares
`environment:`, through a composite action the package ships. `deploy-app.yml` keeps the check and the
build for that app and runs the same action itself for every other caller, so there is one
implementation of render, send and verify.

## Context

Issue #468 (labels `enhancement`, `pkg: deploy`, `adoption`, `blocker`): an adopting app's first
release on `deploy-app.yml` 0.2.1 stopped at "Check the environment's SSH secrets" with all four SSH
names missing. The app's repository belongs to a user account; `secrets: inherit` passes nothing to a
workflow of another owner, and environment secrets reach a reusable workflow only when the caller
passes them, which a `uses:` job cannot do for an environment. Copying everything to repository
secrets was refused by the owner (2026-10-14): the app has two environments, and per-environment
secrets must be the package's feature.

## Constraints

- Callers of `deploy-app.yml` 0.2.x keep working unchanged (named secrets, `secrets-from-environment`).
- No value is ever interpolated into a script; every input reaches a script through `env:`.
- The end-to-end test (`e2e-deploy.yml`) keeps passing and exercises the action.
- Release of `@softure-ai/deploy` after the merge (owner's standing approval); the adopting app moves
  to the new shape in its own repository afterwards.

## Notes

- Frame skipped: the cause is measured (run log of the adopting app, GitHub docs on reusable
  workflows and `job.workflow_sha`); the owner fixed the direction in the thread.
