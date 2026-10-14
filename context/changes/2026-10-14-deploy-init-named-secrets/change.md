---
change_id: deploy-init-named-secrets
title: "deploy: init's caller and the example pass secrets by name (issue #486)"
status: open
roadmap_item: null
issue: 486
branch: claude/project-thread-jpk73u
created: 2026-10-14
updated: 2026-10-14
---

## Intent

The deploy caller that `softure-deploy init` writes, and `tools/deploy/examples/deploy.yml`, no longer hand
the whole secrets context to `deploy-app.yml` (`app-secrets: ${{ toJSON(secrets) }}`). An app that runs `init`
or copies the example gets no CodeQL `actions/excessive-secrets-exposure` alert in its own repository: each
secret the compose file requires reaches the deploy action by name.

## Context

Issue #486 (labels `enhancement`, `pkg: deploy`), follow-up of #476 (PR #487, on master), which gave the deploy
action `secret-names` and removed every whole-context read from `deploy-app.yml` and the action. Deploy 0.4.0 is
not released yet; the #476 thread releases it after this change merges. Parallel changes on `deploy init`:
#473 (PR #480, header comments of the generated callers) and #471 (PR #482, worker service in compose and
Dockerfile).

## Constraints

- Apps that already ran `init` keep working unchanged: `deploy-app.yml` still accepts `app-secrets`.
- The adopting app's repository is not changed here; the CHANGELOG (Unreleased) and the issue comment carry
  the migration.
- No version bump: deploy 0.4.0 is cut by the #476 thread.
- No `toJSON(secrets)` and no `secrets[...]` in any generated or example caller.

## Notes

- Frame skipped: the issue states the problem and the measured scanner rule; research confirms the shapes.
