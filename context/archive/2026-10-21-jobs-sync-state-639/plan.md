---
change_id: jobs-sync-state-639
status: archived
---

# Plan: jobs sync state (issue #639)

Input: change.md, research.md. Complexity: medium (one migration, one server file, options, worker hook, tests, docs).

## Goal

An app that polls a source keeps a cursor and a processed-item ledger in `@softure-ai/jobs` instead of its own tables.

## Approach

One migration with two tables; a `src/server/sync.ts` with the five functions; a `retention.syncItemsDays` option
(default 90); the worker's hourly prune also prunes the ledger. Rejected: a companion package (a second context and
migration set for two tables); pruning through a ready-made schedule (needs app config for what the worker already does
hourly); `processSyncItem` without a transaction (the outcome could commit apart from the caller's writes).

## Phase 1: tables, API, tests

Files: `modules/jobs/migrations/0004_create_sync_state.sql`, `src/schema.ts`, `src/contract.ts`, `src/messages/en.ts`,
`src/options.ts`, `src/server/sync.ts`, `src/server/index.ts`, `src/index.ts`, `src/testing/index.ts`,
`src/worker/run-job-worker.ts`, `module.json`, `tests/sync.test.ts`, `tests/module.test.ts`.

1. Migration: `sync_cursors (source pk, cursor, created_at, updated_at)`; `sync_items (source, item_id, status pending |
   done | skipped | failed, error_code, attempts, result_ref, first_seen_at, last_seen_at, updated_at, finished_at,
   pk (source, item_id))` with checks (finished_at set exactly when not pending; error_code on failed; lengths) and
   indexes for listing by `updated_at` and pruning by `last_seen_at`.
2. `processSyncItem`: upsert-and-touch in a transaction; not pending → `skipped`; attempts used up → `failed` without
   running; else run in a savepoint; ok → done / skipped (`skipSyncItem`), err → pending or failed (`failSyncItem`
   fails at once), throw → failure recorded, then rethrown.
3. Cursor CAS, list, prune; worker hook; testing helper `listSyncState`.
4. Tests: every outcome, concurrent-safe CAS refusals, rollback of the caller's writes on failure, a throw counted,
   listing filters, pruning by last sighting, the default retention.

## Phase 2: docs

Files: `modules/jobs/README.md`, `modules/jobs/CHANGELOG.md`, `module.json` tables, manifest.

1. README: a "Sync state for polling" section, tables in §5, copy keys in §9.
2. CHANGELOG `## Unreleased`: the feature and the app's migration (run migrations; replace own tables).

## Risks and rollback

Additive. Roll back: revert the commits; the migration's header says how to drop the two tables.

## Progress

- [x] Phase 1: tables, API, tests (migration 0004, `sync-cursors.ts`, `sync-items.ts`, `sync.ts`, worker prune,
  `listSyncState`; 22 tests in `tests/sync.test.ts`, constraint tests in `tests/module.test.ts`, worker prune test)
- [x] Phase 2: docs (README "Sync state for polling", §1, §3 retention, §5 tables, §9 copy, §11 GDPR; CHANGELOG
  `## Unreleased` with the app's migration)
