---
change_id: db-optional-drivers
reviewed: a06eb0a..ce8c942
date: 2026-10-07
verdict: approved
---

# Implementation review: db-optional-drivers

Checked the diff against `plan.md` and the issue's "Done when", then ran both one-driver apps for real.

## Verification

The example app staged as `npm run e2e:deploy-init` stages it (tracked files, workspace packages packed into
`vendor/`, a fresh install), `BUILD_STANDALONE=1 next build`, the standalone server started with
`node server.js`, and the migrate runner bundled with the Dockerfile's esbuild command:

| app | `next build` | `.next/standalone/node_modules` | migrate bundle | `/api/health` |
| --- | --- | --- | --- | --- |
| `pg` only (the example as committed) | passes | `pg` and its deps, `drizzle-orm`, no PGlite | 25 migrations applied on Postgres 16 | 200, all 11 checks `ok` |
| PGlite only (`pg` removed, `serverExternalPackages: ["@softure-ai/db", "@electric-sql/pglite"]`) | passes | `@electric-sql/pglite`, `drizzle-orm`, no `pg` | 25 migrations applied on `pglite://<dir>` | 200, all 11 checks `ok` |

The missing-driver error, seen from the real bundles: a `pglite://` URL in the pg-only image and a
`postgres://` URL in the PGlite-only image each print `createDatabase: <scheme> URLs need the "<package>"
package, which is not installed; …`. The unit tests for `explainMissingDriver` failed before the helper existed.
Gates: `npm run typecheck`, `npm run lint`, `npm test` (318 files passed, 6 skipped) green.

## Findings

| # | Severity | Finding | Decision |
| --- | --- | --- | --- |
| 1 | Critical | Plan review finding 1 reproduced: with only `pg`, `migrate.mjs` failed at start with `Cannot find package '@electric-sql/pglite'`. esbuild inlines the dynamic `import("drizzle-orm/pglite")`, and the adapter's static import of the external driver becomes a top-level import of the bundle (the same happens to `pg` in a PGlite-only app). | Fixed in ce8c942: the esbuild command also leaves `drizzle-orm/pglite` and `drizzle-orm/node-postgres` external, in the example Dockerfile, the deploy template and both READMEs. Plan updated (Phase 2). |
| 2 | Warning | The example's lockfile still listed PGlite (db's stale entry, then an orphaned `optional` peer entry that `npm ci` installs anyway), so CI would not have proved the pg-only path. | Fixed: db's entry refreshed and the orphan dropped; `npm ci` in the example installs no PGlite. |
| 3 | Warning | In a Next app db's adapters load natively while the modules' drizzle query builders are bundled: two copies of drizzle code at run time. drizzle matches classes by `entityKind` strings, and every module's health check (each a real query) passed on both drivers. | Accepted; the CI e2e job runs the full Playwright suite on the pg-only example. |
| 4 | Suggestion | `softure-deploy init` could warn when a database app's `next.config` lacks the setting. | Filed as #184 (deploy is being edited by another change). |
| 5 | Suggestion | Adopting apps upgrading `@softure-ai/db` must now install their driver and add the Next.js setting. | For the release notes of the next db version; db README §2 has the steps. |

No open blocking finding.
