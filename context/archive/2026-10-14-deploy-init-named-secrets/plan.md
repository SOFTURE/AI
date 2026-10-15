# Plan: deploy-init-named-secrets

## Goal

`init`'s generated `deploy.yml` and `examples/deploy.yml` deploy through `deploy-app.yml` with `deploy: false`
and the deploy action in a `production` job, each compose secret passed by name. No `toJSON(secrets)` in either.

## Phase 1: The generated caller

1. `deploy.yml.tmpl`: jobs `build` (deploy-app.yml, `deploy: false`, the app's domain, image and health path)
   and `deploy` (`environment: production`, concurrency per environment, `contents: read, packages: read`, one
   step: the deploy action at `{{workflowsRef}}` with `env:` per required name and `secret-names`, the SSH,
   origin and verify secrets, `app-vars: ${{ toJSON(vars) }}`).
2. `generate.ts`: values `hasSecretNames`, `secretEnvLines`, `secretNameList` from the compose file's required
   names.
3. `generate.test.ts`: the generated caller has the two jobs, only declared inputs on `build` and only the
   action's inputs on the step, `env:` equal to the compose names (each `${{ secrets.NAME }}`) and
   `secret-names` listing them, none without a required name, the action pinned with `--workflows-ref`, and no
   `toJSON(secrets)`.

## Phase 2: The example, docs and changelog

1. `examples/deploy.yml`: the same two-job shape plus `report` (`needs: [build, deploy]`).
2. `tests/repo/deploy-workflows.test.ts`: the example caller block follows the new shape; a guard that no
   example or template caller contains `toJSON(secrets)`.
3. README (deploy workflow intro, init's file table and secrets bullet), CHANGELOG `## Unreleased` with the
   migration for an app that already ran `init`.

## Decisions (auto)

- D1: the two-job form (issue's option 1); option 2 is still flagged by the query.
- D2: the generated caller keeps no `report` job, as before; adding one is a separate behaviour change.
- D3: `origin-address` stays the `DEPLOY_ORIGIN_IP` secret (init's `next` line and existing apps use it).
- D4: one job named `deploy` for production, so the job name apps see in the Actions tab stays.

## Progress

- [x] Phase 1: `1786d41`
- [x] Phase 2: `5badde2`
- [x] Implementation review: `reviews/impl-review.md`, no blocking finding
