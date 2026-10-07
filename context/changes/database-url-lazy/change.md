---
change_id: database-url-lazy
title: "Empty database URL refused at connection, not at config definition"
status: plan_reviewed
roadmap_item: none
issue: "#155"
branch: claude/project-thread-dwtogg
created: 2026-10-07
updated: 2026-10-07
---

## Intent

Close [issue #155](https://github.com/SOFTURE/AI/issues/155). The documented config line
`database: { url: process.env.DATABASE_URL ?? "" }` makes `defineSoftureConfig` throw
`SoftureConfigError (database.url must not be empty)` whenever `DATABASE_URL` is unset. Two documented build
steps import the config without a database: `--export-migrations` (db README §4, "needs no database") in a
Docker builder stage, and `next build` (the root layout imports the config, docs/02 §8). Both fail.

After this change an empty `database.url` is a database that is not configured *yet*: `defineSoftureConfig`
accepts it, and the first attempt to connect (`createDatabase`, so also `getSharedDatabase`, `softure migrate`,
the ops scripts, the module CLIs) refuses it with an error that names the fix (set `DATABASE_URL`). Every other
config check still runs at definition. The READMEs and docs/02 show the same pattern as the example app.

A reviewer checks `foundation/core/tests/config.test.ts` (empty URL accepted, with and without schema modules),
`foundation/db/tests/client.test.ts` and `foundation/db/tests/cli.test.ts` (empty URL refused at connection;
`--export-migrations` succeeds with an empty URL), and the README/docs wording.

Input: GitHub issue #155, filed by an app adopting the packages. Issues are tracked in GitHub Issues, not in a
roadmap, so this change is not placed in a roadmap.

## Context

- `foundation/core/src/config.ts:34-38` validates `database.url` with `z.string().min(1)`.
- `withDatabaseOptional` (BF-6) already reads an empty URL as `database: null`, but only for a dynamic import
  wrapped by a command; an app script (`import config from "../softure.config"`) and the Next.js root layout import
  the config statically, so they cannot use it.
- `examples/next-app/softure.config.ts:51` avoids the problem with a hardcoded local fallback URL.
- Every connection goes through `createDatabase(url)` (`foundation/db/src/client.ts`); today an empty URL fails
  there as `unsupported database URL scheme (none)`.

## Constraints

- Touches `foundation/core/src/config.ts`, `foundation/db/src/client.ts`, their tests, `foundation/core/README.md`,
  `foundation/db/README.md`, `docs/02-module-standard.md`. Parallel issues: #153 changes `foundation/db`
  (migration hooks), #152/#154 add keys to `core/src/config.ts`; this change stays inside the `database` key and
  `createDatabase`'s scheme check to keep conflicts small.
- `SoftureConfig`'s type does not change (`{ url: string } | null`), so no module adapter changes.
- No version bump, release or npm publish; the next release carries it.
- English-only code, comments and commits.

## Process notes

- Research: skipped. The issue carries the measurements (both failing paths, file and line), and the code involved
  is two functions read in full here: `defineSoftureConfig` and `createDatabase`. Every consumer of
  `config.database.url` (13 call sites, `grep -rn "database.url"`) reaches the database through `createDatabase`,
  either directly or via `getSharedDatabase`; the ops health route checks `startsWith("pglite://")` first, which an
  empty string fails harmlessly.
- Framing: skipped. The issue names the problem and its cause precisely (eager `min(1)` on a value that only the
  runtime has), and offers the two fixes considered in `plan.md`; there is no competing explanation.
