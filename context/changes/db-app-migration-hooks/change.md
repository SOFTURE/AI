---
change_id: db-app-migration-hooks
title: "App migrations next to module migrations"
status: impl_reviewed
roadmap_item: null
issue: 153
branch: claude/project-thread-tjueq8
created: 2026-10-07
updated: 2026-10-07
---

## Intent

An app with its own migrations (e.g. dozens of drizzle files in `public`, ledger `drizzle.__drizzle_migrations`)
runs them in the same, ordered step as the module migrations, the same way in dev, unit tests, integration and the
production image:

- `migrate(handle, { modules, app: { before?, after? } })`: `before` runs ahead of the module files (app tables a
  module references), `after` behind them (app migrations that reference a new module table). Both run under the
  migration lock; a failure is a `db.app_migration_failed` problem, not a throw.
- the same `app` option in `runMigrateCli` and `createTestDatabase(modules, { app })`, with the hooks part of the
  template cache key;
- the order and a drizzle recipe documented in the db README, docs/02 §4 and docs/05;
- the related gaps the issue measured: "ESM only" in the README with a clear error from `resolveMigrationsDir` in a
  CJS bundle, the `drizzle-kit generate` caveat (reference module tables, never re-export them from the app schema
  file), and `drizzle` reserved as a schema name.

A reviewer checks `foundation/db/tests/app-migrations.test.ts`, the `createTestDatabase` cases in
`foundation/db/tests/testing.test.ts`, the CLI cases in `foundation/db/tests/cli.test.ts`, the
`resolveMigrationsDir` case in `foundation/core/tests/module.test.ts`, and the README / docs sections.

## Context

Source: GitHub issue [SOFTURE/AI#153](https://github.com/SOFTURE/AI/issues/153) (filed 2026-10-07 while planning an
app's switch to the packages). Issues are tracked in GitHub Issues, not in a roadmap, so this change has no roadmap item. The PR closes #153.

## Constraints

- Owns `foundation/db/src/migrations/migrator.ts` (app hooks, reserved schema), `foundation/db/src/testing.ts`,
  `foundation/db/src/cli/run.ts`, `foundation/db/src/migrations/problems.ts`, `foundation/core/src/module.ts`
  (`resolveMigrationsDir` only) and the db README; touches docs/02 §4 and docs/05 step 3.
- Out of scope, owned by other issues: adoption baselines and `--adopt` ordering of dependencies (#152, `adopt.ts`),
  other `foundation/db` changes (#154), `foundation/core/src/config.ts` (#155). The `softure` bin keeps reading only
  the config; hooks need an app script (`runMigrateCli`), because putting them in the config is #155's file.
- English-only code, comments and commits (AGENTS.md).
- Bumps `@softure-ai/db` 0.1.5 → 0.1.6 and `@softure-ai/core` 0.1.5 → 0.1.6; no release, tag or publish by the agent.

## Process notes

- Research: done, short ([`research.md`](research.md)); the issue carries the measurements, research checks them
  against the code and answers how drizzle's migrator and a CJS bundle behave.
- Framing: skipped. The problem (no place for app migrations in the migrate step) is measured in the issue, the
  issue proposes the shape (`before`/`after` hooks), and research found no cheaper path: the only alternative, a
  second ledger in `softure.migrations` for app files, would duplicate drizzle's journal and break every app's
  existing history.
