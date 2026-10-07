---
change_id: db-adoption-baseline
title: "Adoption baselines and dependency-first adoption"
status: archived
roadmap_item: null
issue: 152
branch: claude/project-thread-f8j2qr
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

An app that adopts a module keeps its own migration history, so every fresh database (unit-test template,
integration stack, a reset dev database) recreates the pre-adoption tables before the module files run. Today that
breaks three ways (issue #152):

1. **Fresh databases.** `migrate` fails with `relation … already exists`, and `adoptModule` compares against every
   file of the enabled version, so once a module ships a new migration the app cannot build a fresh database at all.
2. **A new dependency.** Adopting a module whose dependency has pending migrations is refused, and a plain migrate
   fails on the module's first file; only a hand-written order works.
3. **All or nothing.** Adoption covers every file, so the app must hand-copy the module's later SQL (new tables) into
   its own migration to make the schemas match.

After this change:

- an app declares a **baseline** next to its own migrations, `app: { before, baseline: { auth: 1 } }`: the module
  files its own history already creates. `migrate` (CLI, `createTestDatabase`, image) then adopts or migrates by
  itself: when the module is new to the ledger and its schema holds objects after `before`, it compares the schema
  with files 1..N, records them as `adopted` and applies N+1.. normally; an empty schema migrates normally. The same
  command is safe on every deploy and on every fresh database;
- `adoptModule(handle, { …, through: N })` / `softure migrate --adopt <module>@<version> --through N` adopt files
  1..N only; the rest stays pending for the next migrate;
- `adoptModule` and `--adopt` apply the pending migrations of the module's dependencies first (in dependency order,
  under the same lock), instead of refusing;
- `--plan` marks the files a baseline may adopt;
- docs/05 step 3, docs/02 §4 and the db README describe the baseline.

A reviewer checks `foundation/db/tests/baseline.test.ts`, the changed cases in `foundation/db/tests/adopt.test.ts`,
`foundation/db/tests/cli.test.ts`, `foundation/db/tests/testing.test.ts`, and the README / docs sections.

## Context

Source: GitHub issue [SOFTURE/AI#152](https://github.com/SOFTURE/AI/issues/152), measured on `@softure-ai/db@0.1.5`
by an adopting app with its own drizzle history. Builds on #153 (app migration hooks, `app: { before, after }`) and
#155 (lazy `database.url`), both on master. Issues are tracked in GitHub Issues, not in a roadmap, so this change has
no roadmap item. The PR closes #152.

## Constraints

- Owns `foundation/db/src/migrations/adopt.ts`, `migrator.ts` (baseline, unit-by-unit run), `problems.ts`,
  `foundation/db/src/cli/run.ts`, `foundation/db/src/testing.ts` (cache key only), the db README, docs/02 §4 and
  docs/05 step 3.
- Out of scope: `foundation/core/src/config.ts` and the shared database handle (#154), ops / deploy docs (#158). The
  baseline therefore lives on the app's migrations object, not in the core config (see research).
- `@softure-ai/db` stays at the unreleased 0.1.6; no release, tag or publish (#154 and #158 still change db/core).
- English-only code, comments and commits (AGENTS.md); neutral wording on GitHub.

## Process notes

- Research: done, short ([`research.md`](research.md)): checks the issue's measurements against the code and decides
  where the baseline lives and how non-prefix adoption is handled.
- Framing: skipped. The problem is measured case by case in the issue, the issue proposes the shape (a per-module
  baseline, dependency-first adoption), and research found the one open question (config-level vs app-level
  baseline) answerable from the code; there is no cheaper path that keeps fresh databases buildable.
