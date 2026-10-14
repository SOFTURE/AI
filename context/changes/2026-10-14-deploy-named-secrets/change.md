---
change_id: deploy-named-secrets
title: "deploy: no whole secrets context, secrets passed by name (issue #476)"
status: planned
roadmap_item: null
issue: 476
branch: claude/project-thread-8shtbi
created: 2026-10-14
updated: 2026-10-14
---

## Intent

No workflow or example of `@softure-ai/deploy` hands the whole secrets context to a runner any more, so
CodeQL alert #47 (`actions/excessive-secrets-exposure`) closes on the next scan and an app that copies
the environment example gets no such alert in its own repository. The deploy action takes the app's
secrets by name from its step's `env:`.

## Context

Issue #476 (labels `enhancement`, `pkg: deploy`), follow-up of #468 / #470. The alert flags
`toJSON(secrets)` in `deploy-app.yml`'s deploy job under `secrets-from-environment`. The same pattern is
in `tools/deploy/examples/deploy-environments.yml`. Deploy 0.3.0 is released; parallel changes on the
deploy package: #473 (PR #480) and #471 (PR #482).

## Constraints

- Apps already on the deploy action (0.3.0) keep working unchanged: `app-secrets` JSON stays accepted.
- No value is interpolated into a script; every input reaches a script through `env:`.
- The end-to-end test (`e2e-deploy.yml`) keeps passing.
- The adopting app's repository is not changed here; the CHANGELOG and the issue comment carry the
  migration.

## Notes

- Frame skipped: the problem is a measured scanner finding with the query source read (research §1).
