---
change_id: db-process-glue-404
title: "db: entry-point guard and process glue for createProcessDatabase (issue #404)"
status: archived
roadmap_item: null
issue: 404
branch: claude/project-thread-r2wrmw
created: 2026-10-12
updated: 2026-10-12
archived_at: 2026-10-12
---

## Intent

Close [issue #404](https://github.com/SOFTURE/AI/issues/404) (labels `enhancement`, `pkg: db`, `adoption`): the glue an
adopting app on `createProcessDatabase` still writes around `@softure-ai/db`.

1. Entry-point guard in `@softure-ai/db/testing`: `findEntriesReachingDatabase({ entries, clientModule })` lists the
   entries whose import graph reaches the app's database client and whether each opens it;
   `expectEntriesOpenDatabase(options)` throws naming the entries that reach it without opening it.
2. `createProcessDatabase(url, { globalKey })` keeps its state on `globalThis`, so a re-evaluated module (HMR) finds the
   open database; `closeProcessDatabases()` closes every process database (tests).
3. `drizzleAppMigrations(folder)`: an `AppMigrationHook` that runs drizzle's migrator for the handle's driver.
4. `openRawDatabase(url)` and `queryDatabase(handle, text, values)`: parameterized raw SQL over whichever driver the URL
   names, for operator and report scripts.

A reviewer checks `foundation/db/tests/process-glue-404.test.ts`, `foundation/db/tests/entry-guard.test.ts`, the README
and the CHANGELOG `Unreleased` entry.

## Context

db is at 0.1.7 on master. Releases are batched by the coordinator, so this change bumps no version: the CHANGELOG gets
an `## Unreleased` section.

## Constraints

- Additive only: no existing signature or default changes; `DatabaseHandle` keeps its shape (custom handles made with
  `createPostgresHandle` / `createPgliteHandle` stay valid).
- esbuild stays out of the runtime entry: the guard loads it with a dynamic `import()` and it is an optional peer.

## Process notes

- Framing: skipped. The issue states each gap, its cost in the app and a proposal.

## Decisions (auto)

- No version bump; `## Unreleased` in the CHANGELOG (batched releases).
- Item 4: free functions (`queryDatabase`, `openRawDatabase`) instead of a `query` member on `DatabaseHandle`, so
  handles an app builds itself and `isDatabaseHandle` keep working.
- Item 1: "opens the database" is a pattern over the entry file's own source (default: a call to `withDatabase(` or
  `.open(`), configurable with `opens`; the app's metafile check did the same.
