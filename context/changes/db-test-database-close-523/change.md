---
change_id: db-test-database-close-523
title: "db: createTestDatabase's close() resolves on a copy that was never queried (issue #523)"
status: in_progress
roadmap_item: null
issue: 523
branch: claude/project-thread-lxbetu
created: 2026-10-15
updated: 2026-10-15
---

## Intent

Close [issue #523](https://github.com/SOFTURE/AI/issues/523): `createTestDatabase()` returns before PGlite has
loaded the template's data folder, and `close()` on a copy that was never queried never resolves. A test file with
`beforeEach(createTestDatabase)` / `afterEach(close)` and one test that does not touch the database times out in
`afterEach`. After this change `close()` is safe at any point.

## Context

db is at 0.1.10 on master. Releases are batched by the coordinator: no version bump, the CHANGELOG gets
`## Unreleased`.

## Constraints

- No API change: `TestDatabase`, `createPgliteHandle` and `createDatabase` keep their signatures.
- The fix starts with a test that fails without it.

## Notes

- Framing: skipped. The issue names the cause, the reproduction and the fix.

## Decisions (auto)

- Wait in `createPgliteHandle` rather than only in `createTestDatabase`: every PGlite handle (test copies,
  `createDatabase("pglite://…")`, an app's own client wrapped for `database.handle`) is then ready when returned, so
  `close()` is safe on all of them. One line covers every caller.
