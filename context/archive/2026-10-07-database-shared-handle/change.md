---
change_id: database-shared-handle
title: "One database handle per process: the app's handle in the config, typed and driver-optional"
status: archived
roadmap_item: none
issue: "#154"
branch: claude/project-thread-rvyfnt
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close [issue #154](https://github.com/SOFTURE/AI/issues/154). Every module adapter opens its handle with
`getSharedDatabase(config.database.url)`. An app that already has its own client therefore runs two handles in
one process: a second pool on Postgres, and on `pglite://` two PGlite instances on one data directory, which
corrupts the directory silently (`PANIC: could not locate a valid checkpoint record` on the next open).

After this change:

- `defineSoftureConfig({ database: { url, handle } })` takes the app's own handle once, as a lazy function, and
  every module adapter, the health route and every package command use it. Without `handle`, behaviour is
  unchanged (the process-wide `getSharedDatabase(url)` handle).
- The reverse path is documented too: an app can build its own typed drizzle instance over the shared handle.
- `Database<TSchema>` / `Queryable<TSchema>`: an app database created with `drizzle(…, { schema })` is
  assignable to what module functions take.
- `@electric-sql/pglite` and `pg` stay dependencies of `@softure-ai/db` with ranges widened to `^0.5.0` and
  `^8.11.0` (an app's own pinned copy is shared, not nested); `@types/pg` leaves `dependencies` for an optional
  peer. Optional driver peers were tried and dropped: Next.js resolves both drizzle adapters at build time (see
  `reviews/impl-review.md`, finding 5).
- `createPgliteHandle` is exported, with a `createPostgresHandle` counterpart, so an app can wrap its own client.
- `withSession` on PGlite restores only the settings a migration run changed instead of `RESET ALL`, so a shared
  connection keeps the app's `TimeZone` and `search_path`.

A reviewer checks `foundation/db/tests/configured.test.ts` (handle resolution), `foundation/db/tests/session.test.ts`
(settings kept), `foundation/core/tests/config.test.ts` (the `handle` key), the adapters' tests, and the db README §3.

Input: GitHub issue #154, filed while an app planned its switch to the packages. Issues are tracked in GitHub
Issues, not in a roadmap, so this change is not placed in a roadmap.

## Context

- Adapters: `modules/{auth,mcp-access,blog,waitlist,billing,mailing,feature-switches,privacy,analytics}/src/next/context.ts`,
  `modules/blog/src/{proxy/index.ts,sitemap.ts}`; health route `modules/ops/src/next/route.ts` (refuses `pglite://`
  without `getDatabase`); commands `foundation/db/src/cli/run.ts`, `modules/{blog,mailing}/src/cli/run.ts`,
  `modules/ops/src/scripts/ops-script.ts`.
- Types: `foundation/db/src/client.ts:14-23`. Session: `foundation/db/src/migrations/session.ts:28`.
- `examples/next-app/lib/database.ts` opens a second pool next to the modules' shared one, the exact pattern the
  issue describes.

## Constraints

- Parallel work: issue #170 changes `foundation/db/src/migrations/adopt.ts`; this change does not touch it.
- No version bump and no release of `db` or `core` here (a later issue releases them last). Other packages touched
  are released after the merge.
- English-only code, comments and commits. Public texts neutral (no app names).

## Process notes

- Research: written as `research.md` (short: the call sites, the type experiment, the PGlite settings behaviour).
- Framing: skipped. The issue measured the failure and its cause (two instances on one directory) and offers two
  fixes; both are cheap and complementary (a config key for apps that own a client, documentation for apps that
  can adopt the shared one), so there is no competing problem statement to weigh.
