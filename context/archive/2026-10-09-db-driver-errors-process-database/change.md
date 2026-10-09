---
change_id: db-driver-errors-process-database
title: "db: export driver-error helpers and a process-wide synchronous db handle (issue #313)"
status: archived
roadmap_item: null
issue: 313
branch: claude/project-thread-nny9g6
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

Close [issue #313](https://github.com/SOFTURE/AI/issues/313), two gaps an adopting app filed against `@softure-ai/db`:

1. `findDriverError` is private and copied in `blog` (`db/publish-run.ts`) and `privacy` (`server/copy-account.ts`);
   the adopting app keeps a third copy plus a "unique violation on constraint X" check. `@softure-ai/db` exports
   `findDriverError(error)` and `isConstraintViolation(error, { code, constraint })`; blog and privacy drop their copies.
2. Apps with a module-level `db` keep ~80 lines of a synchronous proxy over `getSharedDatabase`, with open/close,
   `withDatabase(main)` for scripts and a "Database is not open" guard. `@softure-ai/db` exports
   `createProcessDatabase(url, options) → { db, open, close, withDatabase, isOpen }`.

A reviewer checks `foundation/db/tests/driver-errors.test.ts`, `process.test.ts`, the new `shared.test.ts` case, the
README sections "A module-level `db`" and "Driver errors" and the three CHANGELOG entries.

## Context

Work is tracked in GitHub Issues (no roadmap item). db 0.1.6, blog 0.1.10 and privacy 0.1.10 are on npm, so the
change ships as db 0.1.7, blog 0.1.11 and privacy 0.1.11; blog and privacy require `@softure-ai/db` `^0.1.7`.

## Constraints

- Blog and privacy behave exactly as before (same codes, constraints, messages).
- One pool per process: the process database opens the handle `getSharedDatabase(url)` gives the modules.
- No new dependency; drizzle adapters load through dynamic `import()` like `client.ts`.

## Process notes

- Research: skipped as a separate file. The issue names both copies and the proposed API; reading `client.ts`,
  `shared.ts`, `configured.ts`, both copies and the README §3 answered every unknown (plan.md, "Today").
- Framing: skipped. The issue states the gap and the proposal; the API is settled in plan.md.
