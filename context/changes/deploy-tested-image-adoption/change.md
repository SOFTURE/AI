---
change_id: deploy-tested-image-adoption
title: "deploy: adoption gaps for an app that deploys the image it tested (issue #246)"
status: plan_reviewed
roadmap_item: null
issue: 246
branch: claude/project-thread-c6wqyj
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Close [issue #246](https://github.com/SOFTURE/AI/issues/246): an adopting app that builds its image once, runs its
integration suite on that image and deploys it with its own release job, gateway and schema guard cannot replace
them with `@softure-ai/deploy` yet. Five gaps, all in this change:

1. `deploy-app.yml` deploys a prebuilt image (re-tagged by digest, no build), so production runs the image the tests
   saw.
2. `schema-guard` also guards an app's own drizzle ledger (`drizzle.__drizzle_migrations`) against the image's
   journal, and reads ledger rows from a file or stdin (psql output) instead of a connection from the host.
3. `init`'s `deploy.sh` runs the app's own steps at named hook points (`pre-migrate`, `post-up`, `maintain`).
4. `init`'s `deploy.sh` reaches an unpublished Postgres through `docker compose exec -T postgres` with the
   container's own `POSTGRES_USER`/`POSTGRES_DB`, for backup, schema guard and row counts.
5. `softure-deploy env render` reads the values from JSON objects (`toJSON(secrets)`, `toJSON(vars)`), like the
   reusable workflow.

A reviewer checks the tests named in plan.md, the README sections "Deploy workflow", "Database steps around a deploy",
"`softure-deploy env render`" and "`softure-deploy init`", and the CHANGELOG.

## Context

Issue #246 was filed while an app audited the package against its own release pipeline (the README "Parity" section).
Work is tracked in GitHub Issues: no roadmap item; the PR closes the issue. The smaller differences the issue lists
(row counts fail only on a drop, release-notes markers) stay app-side, as the issue says.

## Constraints

- Existing apps keep working: every new behaviour is opt-in (a workflow input, a flag, a script variable, a hook file).
- Shell stays within bash 3.2 and flags BSD and GNU tools both accept (AGENTS.md); the deploy.sh tests run on macOS.
- Values from secrets are never printed; the CLI never echoes a database URL.
- English-only code and docs; no app-specific names in the package.

## Process notes

- Research: skipped as a separate file. The issue names each gap precisely, and the package's own code answered every
  unknown (`deploy.sh.tmpl`, `deploy-app.yml`, `schema-guard.ts`, `row-counts.ts`, `backup.ts`, `env-command.ts`,
  drizzle-orm's `migrator.js` for the ledger's columns and hash). The findings are in plan.md's "Today" section.
- Framing: skipped. The issue proposes the shape of each fix; the two choices it leaves open (where hook points are
  declared, how the compose-exec mode reaches the CLI) are settled in the plan's key decisions.
