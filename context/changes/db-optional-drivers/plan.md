---
change_id: db-optional-drivers
status: plan_reviewed
updated: 2026-10-07
---

# Plan: optional drivers for @softure-ai/db

## Approach

Keep the loading as it is (literal `import()` per driver and per drizzle adapter) and make both drivers optional
peers. A Next.js app lists `@softure-ai/db` with its driver in `serverExternalPackages`: Turbopack then leaves the
package to Node and never resolves the adapters, and output tracing follows the literal `import()` calls, copying
the driver the app installed (measured in `change.md`, Context). A missing driver gets an error that says what to
install.

## Key decisions

- **D1. `serverExternalPackages`, not bundler-ignore comments or driver entry points.** Comments make tracing skip
  the driver (measured); entry points would add a registration step to every app, module test and script.
- **D2. Literal specifiers stay.** A computed specifier would hide the driver from tracing as the comments do.
- **D3. Peer ranges stay `^8.11.0` and `^0.5.0`,** both `optional`; the package keeps them as devDependencies for
  its own tests, so the workspace still installs them.
- **D4. The error names the package, not the URL.** `createDatabase` turns `ERR_MODULE_NOT_FOUND` for the driver or
  its drizzle adapter into `createDatabase: <url scheme> needs the "<pkg>" package; install it …`, keeping the
  original as `cause`. Any other failure propagates unchanged. A pure helper does the matching so a test can feed
  it errors without uninstalling a package.
- **D5. The example app installs `pg` only** and lists `["@softure-ai/db", "pg"]`, so the CI jobs that build and
  run it (e2e, container, `deploy init image`) prove the pg-only path. The PGlite-only path is verified by hand on
  a staged copy (recorded in the impl review); a CI job for it would duplicate the e2e for one config line.
- **D6. `createTestDatabase` (`@softure-ai/db/testing`) keeps its static PGlite import;** the README says to add
  PGlite as a dev dependency for it, and for `--adopt` and an app baseline (they open a scratch PGlite database).

## Phases

### Phase 1: optional peers and the missing-driver error (TDD)

- `foundation/db/tests/client.test.ts`: tests for the helper first (driver missing → named error with cause; the
  drizzle adapter missing → same; another package missing or another error → returned unchanged), then for
  `createDatabase` keeping its existing behaviour.
- `foundation/db/src/client.ts`: helper `explainMissingDriver(error, driver)` and the wrapping of the four imports.
- `foundation/db/package.json`: `pg`, `@electric-sql/pglite` → `peerDependencies` + `peerDependenciesMeta.optional`,
  and `devDependencies`; root `package-lock.json` refreshed with `npm install`.

Done when: the new tests fail without the helper and pass with it; `npm run typecheck`, `npm run lint`, `npm test`
are green.

### Phase 2: the example app and the docs

- `examples/next-app/package.json` + its lockfile: `pg` in dependencies, `@types/pg` in devDependencies.
- `examples/next-app/next.config.ts`: `serverExternalPackages: ["@softure-ai/db", "pg"]` with a neutral comment.
- `foundation/db/README.md` §2: which driver to install for which URL, the Next.js setting and why, PGlite for tests,
  `--adopt` and a baseline, `@types/pg`.
- The migrate runner's esbuild command (`examples/next-app/Dockerfile`, `tools/deploy/templates/Dockerfile.tmpl`,
  db and ops READMEs) also leaves `drizzle-orm/pglite` and `drizzle-orm/node-postgres` external (added during
  implementation, see the impl review).
- `modules/ops/README.md` (the paragraph under the container recipe) and `docs/02-module-standard.md` (the
  `serverExternalPackages` line): db is the package that needs the setting.

Done when: a staged copy of the example (packed packages, `BUILD_STANDALONE=1`) passes `next build` with only `pg`
and with only PGlite, each standalone server answers `/api/health` with every check `ok`; the Dockerfile's esbuild
command bundles `scripts/migrate.ts` on the pg-only copy and the bundle migrates a database; gates green; CI green
(the e2e job runs the whole Playwright suite on the pg-only example).

## Progress

- [ ] Phase 1: optional peers and the missing-driver error
- [ ] Phase 2: the example app and the docs
