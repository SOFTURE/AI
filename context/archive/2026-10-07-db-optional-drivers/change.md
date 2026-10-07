---
change_id: db-optional-drivers
title: "pg and PGlite become optional peers of @softure-ai/db without breaking next build"
status: archived
roadmap_item: none
issue: "#179"
branch: claude/project-thread-jm3ow0
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close [issue #179](https://github.com/SOFTURE/AI/issues/179). `@softure-ai/db` ships both drivers as
dependencies, `pg` and `@electric-sql/pglite` (about 26 MB), so every app image carries both. Making them
optional peers was tried in #154 and reverted: Next.js (Turbopack) resolves the `import()` calls in
`createDatabase` at build time, drizzle's PGlite adapter imports `@electric-sql/pglite` statically, and
`next build` fails with `Module not found: Can't resolve '@electric-sql/pglite'` in an app that never uses PGlite.

After this change:

- `pg` and `@electric-sql/pglite` are optional peer dependencies of `@softure-ai/db`; an app installs the one its
  URL uses (and PGlite for `createTestDatabase`, `--adopt` and an app baseline).
- A Next.js app lists `@softure-ai/db` (with its driver) in `serverExternalPackages`. The package then loads from
  `node_modules` at run time, the bundler never resolves the driver adapters, and standalone output tracing
  follows the package's own `import()` calls, so the image carries the driver the app installed and nothing else.
- A missing driver fails at the first connection with an error that names the package to install and the Next.js
  setting, instead of Node's bare "Cannot find package".
- The example app installs `pg` only and uses the setting, so CI's e2e, container and `deploy init image` jobs
  build and run an app without PGlite.
- The db README §2 describes the installation.

Done when (from the issue): an app with only `pg` installed passes `next build` (standalone output) and runs; an
app with only PGlite does the same; the db README §2 describes the installation.

## Context

Measured on the example app, staged as a standalone app with packed packages (as `npm run e2e:deploy-init`
stages it), `next build` with `BUILD_STANDALONE=1`, drivers as optional peers and only `pg` installed:

| variant | `next build` | `pg` and `drizzle-orm` in `.next/standalone/node_modules` |
| --- | --- | --- |
| master's `next.config` (`serverExternalPackages: ["@electric-sql/pglite", "pg"]`) | fails: `Can't resolve '@electric-sql/pglite'` (from `client.ts` and from drizzle's pglite adapter) | n/a |
| `/* webpackIgnore */ /* turbopackIgnore */` on the four `import()` calls | passes | **missing**: the ignored imports are not traced, the container would fail at run time |
| same comments, `@softure-ai/db` in `serverExternalPackages` | passes | **missing** (tracing honours the comments too) |
| no comments, `@softure-ai/db` in `serverExternalPackages` | passes | present |

So the issue's first option (imports the bundler does not follow) breaks standalone tracing, and the second
(per-driver entry points registering with `createDatabase`) would make every app, module test and script register
a driver. The third option, a documented `serverExternalPackages` entry, works with no code change to the loading
and keeps tracing exact. Core state (`getSoftureConfig`) and the shared handles live on `globalThis` under
`Symbol.for` keys, so an external copy of db next to bundled modules shares them.

Research and framing are skipped: the issue already lists the options and the table above, measured at the start
of the change, decides between them; no other package loads a driver.

## Constraints

- Neutral wording in the repository and on GitHub.
- No release in this change; the packages are released together after it is merged.
- Another change edits ops, feature-switches, deploy, core, auth, CHANGELOG and README in parallel; this one
  touches `modules/ops/README.md` (one paragraph) and merges master on conflict.
