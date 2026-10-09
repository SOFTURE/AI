---
change_id: deploy-verify-env
title: "deploy-app.yml: pass variables such as a Web Bot Auth key to the verify step (issue #357)"
status: archived
roadmap_item: null
issue: 357
branch: claude/project-thread-req8j0
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #357](https://github.com/SOFTURE/AI/issues/357), the follow-up of #341: `softure-deploy verify` signs a
route's requests when the route has `webBotAuth`, reading the Ed25519 seed from the variable `keyEnv` names (default
`WEB_BOT_AUTH_PRIVATE_KEY`). The verify job of `deploy-app.yml` runs without an environment and without the app's
secrets, so such a route fails there with `WEB_BOT_AUTH_PRIVATE_KEY is not set`.

1. A caller passing secrets by name passes `verify-env` (a JSON object of variables by name); the verify step exports
   those entries for `softure-deploy verify` only, masked.
2. A caller with `secrets-from-environment` lists secret names in `verify-env-names`; the verify job then runs in
   `environment` and exports those secrets for the CLI only.
3. The check job refuses a name that collides with the verify step's own variables or the runner's (`PATH`, `HOME`,
   `NODE_*`, `NPM_CONFIG_*`), a name that is not one, invalid `verify-env`, each form on the wrong path, and both
   with an empty `deploy-config` (verify then does not run the CLI).
4. Callers without the new input and secret behave as today.

## Context

Issue #357 (labels `enhancement`, `pkg: deploy`). No roadmap item; the PR closes the issue. `@softure-ai/deploy` 0.1.8
is unreleased and shared by #308, #309, #310 and #341 (PR #359, which adds `webBotAuth`); this change folds into
0.1.8 and merges after #359.

## Constraints

- Scope: `.github/workflows/deploy-app.yml`, `tools/deploy` (README, CHANGELOG, example caller, tests).
- No step prints a value; the variables reach the CLI's process only, not the step's other commands' output.
- The shell the tests run stays within bash 3.2 and BSD/GNU-common flags (AGENTS.md).
- English-only code and docs; no names of adopting apps.

## Process notes

- Research: skipped. The issue names the gap and both remedies, and the workflow's secret paths were researched in
  `context/archive/2026-10-09-deploy-environment-secrets/research.md` (a job output holding a secret is dropped; an
  environment on the verify job asks for a second approval on protected environments).
- Framing: skipped. The problem is observed and the issue's proposal is taken as is.
