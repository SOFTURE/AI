---
change_id: db-testing-template-reuse-641
title: "db/testing: one migrated template per run and a reusable test database; context-only pushes skip the heavy pre-push jobs (issue #641)"
status: archived
roadmap_item: null
issue: 641
branch: claude/project-thread-h0rzu2
created: 2026-10-21
updated: 2026-10-21
archived_at: 2026-10-21
---

## Intent

Close [issue #641](https://github.com/SOFTURE/AI/issues/641). In an adopting app ~97% of the unit suite is spent in
`createTestDatabase`: the template is migrated once per test file (the cache is a module-level `Map`, and Vitest
isolates modules per file), and every test boots a new PGlite from the template (~0.6 s) even when it only needs empty
tables. Separately, the `@softure-ai/config` lefthook preset runs typecheck, lint and the full suite on a push that
changes only `context/`.

## Context

Labels: enhancement. db 0.1.12 and config 0.1.3 are the latest. Files: `foundation/db/src/testing.ts`,
`foundation/db/src/migrations/drizzle.ts`, a new `foundation/db/src/testing/global-setup.ts` export,
`tools/config/presets/lefthook.yml` and a new bin in `tools/config`. No other open thread touches these packages.
The coordinator releases the batch; this change does not release.

## Acceptance

- `@softure-ai/db/testing/global-setup` is a Vitest `globalSetup` module: it gives the run a template folder, and
  `createTestDatabase` writes each migrated template there once and loads it from disk in every other file and worker.
  The folder is removed at the end of the run.
- The disk key changes when a module's migration files, a drizzle folder, the hooks or the baseline change; hooks that
  cannot be identified across processes (custom functions without `templateKey`) keep today's per-file cache.
- `createTestDatabase(modules, { reuse: true })` hands back a database from a per-file pool: rows restored to the
  template's (seed rows and the migration ledgers included), sequences restored, session state discarded; a database
  whose schema a test changed is dropped and replaced by a fresh copy. Two open databases never share an instance.
- Without the global setup and without `reuse`, behaviour is unchanged.
- The lefthook preset skips `typecheck`, `lint` and `test` on `pre-push` when every file the push changes is under
  `context/`; the language job still runs. A push without an upstream, or with any other file, runs everything.
- This repository's own Vitest config uses the global setup. README and CHANGELOG of both packages document it.

## Notes

- Framing: skipped. The issue measures the costs and proposes the mechanism.

## Decisions (auto)

- One change for the db proposal and the related lefthook point: both serve the same suite cost and the issue
  bundles them; they touch separate packages and release together.
- The option is `reuse: true`, not `reuse: "file"`: the pool lives as long as the module instance, which is one test
  file under Vitest's default isolation but a whole worker with `isolate: false`; a scope name would be wrong there.
- Reset restores the template rather than truncating everything except the ledger: migrations may seed rows, and a
  test must see them as on a fresh copy. Rows are copied out of the template once (`COPY ... TO '/dev/blob'`).
- The disk folder is per run (created and removed by the global setup), so the key need not cover the PGlite or
  package version.
- No `eslint --cache` in the preset: the preset's rules are type-aware, and ESLint's cache keys a file by its own
  content, so a change in one file's types would leave stale results for files that use it (typescript-eslint advises
  against it). Recorded in the preset comment.
