---
change_id: db-testing-template-reuse-641
status: archived
---

# Plan: db/testing template per run, reuse mode, context-only pushes (issue #641)

Input: change.md, research.md. Complexity: medium (two packages, a new export and bin, docs).

## Phase 1: template on disk (TDD)

Files: `foundation/db/src/testing.ts`, `foundation/db/src/testing/global-setup.ts`, `foundation/db/src/migrations/drizzle.ts`,
`foundation/db/package.json` (export `./testing/global-setup`), `foundation/db/tests/testing-template.test.ts`.

1. Tests first: with `SOFTURE_DB_TEST_TEMPLATES` set, the first call writes one file and a second call in a fresh
   module instance (`vi.resetModules`) loads it without running the hooks; a changed migration file gives a new file;
   a custom hook without `templateKey` writes nothing; with `templateKey` it does; the global setup creates the folder,
   sets the variable and its teardown removes it.
2. Implement: stable key (module ids, dirs, a hash of their files; drizzle folder, ledger and file hash; `templateKey`;
   baseline), atomic write (temp file + rename), load into a `Blob`.

## Phase 2: reuse (TDD)

Files: `foundation/db/src/testing.ts`, `foundation/db/tests/testing-reuse.test.ts`.

1. Tests first: a released database comes back with no test rows, seed rows and the ledger intact and identity
   restarted at the template's value; two open databases are distinct; a schema change by a test gives a fresh copy;
   a `SET` does not leak; `close()` twice is harmless.
2. Implement: pool per template key, snapshot (tables, seed blobs, sequences, matviews, fingerprint) taken once from
   the first copy, reset in one transaction.

## Phase 3: lefthook preset (TDD)

Files: `tools/config/presets/lefthook.yml`, `tools/config/src/cli/context-only-push*.ts`, `tools/config/package.json`,
`tools/config/tests/context-only-push.test.ts`, `tools/config/tests/presets.test.ts`.

1. Tests first against scratch git repositories: exit 0 for a context-only range, 1 for any other file, for no upstream
   and for an empty range; the preset's pre-push typecheck, lint and test carry the skip, language does not.
2. Implement the bin `softure-context-only-push` and the skips.

## Phase 4: wiring and docs

`vitest.config.mts` uses the global setup; db and config README and CHANGELOG `## Unreleased`.

## Progress

- [x] Phase 1: template on disk (TDD) (8 tests; the drizzle test first failed because hook and testing module came
  from different module instances, fixed in the test: in a real file they share one)
- [x] Phase 2: reuse (TDD) (8 tests; PGlite sequences resume 32 past their logged value in every copy, so the
  restored id is compared with a fresh copy's; `closeReusedTestDatabases` added for `afterAll`)
- [x] Phase 3: lefthook preset (TDD) (7 bin tests against scratch repositories, preset test for the skips;
  lefthook 2.1.16 honours `skip: [{ run }]` on pre-push, checked by a manual push in a scratch repository)
- [x] Phase 4: wiring and docs (`vitest.config.mts` global setup: `modules/jobs` + `modules/auth` 101 s -> 76 s here;
  db and config README and CHANGELOG, docs/02 §10)
