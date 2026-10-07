# Implementation review: database-shared-handle

Reviewed: commits 7412858 (Phase 1) and 7a0e4ae (Phases 2 and 3), merged with `master` at 4d7ecb9, against
`plan.md`, `change.md` and `reviews/plan-review.md`. Mode: autonomous. Verdict: **approve**. One deviation from
the plan, kept on purpose; no blocking finding.

## Plan conformance

| Plan item | Where | State |
| --- | --- | --- |
| `database.handle` (function, lazy, kept frozen; non-function refused) | `foundation/core/src/config.ts` | done |
| Typed through declaration merging (`SoftureDatabaseHandleTypes`) | core `config.ts`, db `configured.ts` (augmentation emitted in `dist/configured.d.ts`) | done |
| `getConfiguredDatabase`, `openCommandDatabase`, `closeConfiguredDatabases` | `foundation/db/src/configured.ts` | done |
| `createPgliteHandle`, `createPostgresHandle`, `isDatabaseHandle` exported | `foundation/db/src/client.ts`, `index.ts` | done |
| `Database<TSchema>`, `Queryable<TSchema>` with a wide default | `client.ts`, `tests/types.test.ts` | done |
| Restore PGlite settings instead of `RESET ALL` | `migrations/session.ts`, `tests/session.test.ts` | done; also restores a setting the run reset |
| Drivers as optional peers, devDependencies in the workspace | `foundation/db/package.json` | done |
| Eleven adapter call sites | module `next/context.ts`, blog proxy and sitemap | done |
| Ops route: `getDatabase`, else configured/shared for `handle` or `pglite://`, else own pool | `modules/ops/src/next/route.ts` | done; the thrown 500 is gone |
| Commands through `openCommandDatabase` | `softure migrate`, `softure-blog`, `softure-mail`, ops scripts | done; injected test openers keep precedence |
| Docs and example app | db README §2/§3, core README §3, docs/02, docs/05 step 2, ops/blog/mailing READMEs, `examples/next-app/lib/database.ts`, `pg` in the example's dependencies | done |

**Deviation:** the plan said `closeSharedDatabases` would also close configured handles. It does not: the app owns
its handle and closes it at shutdown; a library call that closes the app's pool under it would be surprising.
Tests use `closeConfiguredDatabases`. Recorded in its JSDoc.

## Findings

1. **Suggestion: the example app's scripts still call `createDatabase(config.database.url, { max: 1 })`.** They
   are standalone processes against Postgres, so there is no second handle; switching them to
   `openCommandDatabase` would only matter for an app with `database.handle`. Left as is.
2. **Note: the example app's lockfile snapshot of `@softure-ai/db` is stale** (it already showed 0.1.5 before this
   change); the e2e harness packs the workspace packages, so the lock entry for a `file:` dependency does not
   decide what is installed. Unchanged.
3. **Checked: a handle function that is not memoized.** The resolver caches per function, so one config calls it
   once; across `next dev` reloads a new function is called again. The JSDoc and README require the app's function
   to return its process-wide handle and show the `globalThis` pattern.
4. **Checked: commands close the configured handle.** Correct for a command's own process (a PGlite directory is
   written back on close, verified by reopening it in `cli.test.ts`); `openCommandDatabase`'s JSDoc forbids it in a
   running server, where adapters use `getConfiguredDatabase`, which never closes.

5. **Fixed after the PR opened: optional driver peers break `next build`.** CI's `deploy init image` job built
   the example app without `@electric-sql/pglite` and failed: Turbopack follows `import("drizzle-orm/pglite")` in
   `client.js`, and drizzle's PGlite session imports `@electric-sql/pglite` statically, so an app that never uses a
   driver still needs it at build time. Taking the issue's other option, the drivers stay dependencies with widened
   ranges (`@electric-sql/pglite ^0.5.0`, `pg ^8.11.0`), so an app on another 0.5.x shares one copy; `@types/pg`
   stays an optional peer. Making the drivers truly optional needs bundler-proof loading and is tracked in
   issue #179. The example app's added `pg` dependency was reverted with it.

## Verification

- Red first: core config (2 cases), `configured.test.ts` (module missing), `session.test.ts` (`TimeZone` became
  `Etc/GMT+5`, `search_path` reset), `types.test.ts` (types not generic), `cli.test.ts` configured-handle case
  (exit 1 on the old command), feature-switches `next-database.test.ts` (fail mode `false` through the URL), ops
  `pglite://` case (old route threw). All green after.
- Gates before the master merge: `npm run typecheck`, `npm run lint` clean; `npm test` 317 files passed, 6 skipped
  (4358 tests passed, 77 skipped). After merging `master` (4d7ecb9): `npm ci`, `npm run typecheck`, `npm run build`
  exit 0; the touched suites (db, core, ops, feature-switches, mailing, blog next and CLI, billing guards) 63 files,
  821 tests passed. The pre-push hook runs the full suite again.
