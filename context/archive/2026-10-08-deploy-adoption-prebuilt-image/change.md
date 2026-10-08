---
change_id: deploy-adoption-prebuilt-image
title: "deploy: adoption gaps for an app that deploys the image it tested (prebuilt image, app ledger guard, deploy.sh hooks, compose exec database, env render from JSON) (issue #246)"
status: archived
roadmap_item: null
issue: 246
branch: claude/project-thread-imw5wv
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

Close every point of [issue #246](https://github.com/SOFTURE/AI/issues/246), found while an app with its own release
scripts audited `@softure-ai/deploy` 0.1.4:

1. `deploy-app.yml` deploys a prebuilt image (`image@sha256:…`): no build, the tested image is re-tagged with the
   release tag, so production runs exactly the image the tests saw;
2. `schema-guard` also guards an app's own migration ledger (drizzle's `__drizzle_migrations` against the image's
   `meta/_journal.json`), and has a stdin mode: the ledger snapshot comes from `psql`, no database connection from the
   CLI;
3. the server `deploy.sh` runs app steps at named hook points from `deploy.json` (`pre-migrate`, `post-up`,
   `maintain`, a scheduled `maintain` hook gets its own cron line), so the app keeps its steps without forking the
   template;
4. the database steps reach an unpublished Postgres with its own `POSTGRES_USER`/`POSTGRES_DB` through
   `docker compose exec -T postgres …` (backup, row counts, guard);
5. `env render` takes the values from JSON objects in environment variables (`toJSON(secrets)`, `toJSON(vars)`), so
   there is no second list of names.

A reviewer checks the deploy tests (CLI, server files with the generated `deploy.sh`, workflow steps), the README and
the CHANGELOG.

## Context

Issue #246. Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue. Issues #247 and #248 change the
same package after this one, so this change does not release `@softure-ai/deploy`; the last of them does.

## Constraints

- Scope: `tools/deploy` and `.github/workflows/deploy-app.yml`.
- Today's behaviour stays the default: a `deploy.json` without the new keys, a workflow call without
  `prebuilt-image` and a CLI call without the new flags behave as in 0.1.4.
- The shell the tests run stays within bash 3.2 and BSD/GNU-common flags (AGENTS.md).
- English-only code and docs; no names of adopting apps in the repository.

## Process notes

- Research: a short `research.md` records how the package and the adopting app's scripts work today.
- Framing: skipped. Each point is an observed adoption gap with the remedy the adopter named; the open design choices
  (hook shape, how the snapshot SQL copes with absent tables, prebuilt image repository) are settled in plan.md.
