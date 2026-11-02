---
change_id: jobs-wait-sync-item-939
status: archived
---

# Plan: a sync item failure that waits (issue #939)

Input: change.md, research.md. Complexity: small (one branch in `record`, a helper, a filter, tests, docs).

## Phase 1: waiting failures

Files: `modules/jobs/src/sync.ts`, `modules/jobs/src/index.ts`, `modules/jobs/src/server/sync-items.ts`,
`modules/jobs/tests/sync.test.ts`, `modules/jobs/README.md`, `modules/jobs/CHANGELOG.md`.

1. `SyncItemFailure.retry?: boolean | "wait"`; `waitSyncItem(code)` returns `{ ok: false, error, retry: "wait" }`;
   `SyncItemOutcome` gains `{ kind: "waiting", error, item }`. Export `waitSyncItem`.
2. `record()`: `retry === "wait"` → write only `errorCode` (status stays `pending`, attempts unchanged, `finishedAt`
   stays null) and answer `waiting`; checked before the `maxAttempts` rule, so it never fails the item.
3. `listSyncItems` takes `errorCode?: string` (exact match).
4. Tests: waiting leaves the item pending with attempts unchanged and the code set, and rolls the callback's write back;
   repeated waits never fail it and the next run gets the same attempt number; an item at `maxAttempts - 1` that
   waits stays pending and a later ordinary failure fails it; an ordinary failure still counts; the `errorCode`
   filter lists only the matching items.
5. README "Sync state for polling" and CHANGELOG `Unreleased` with the migration for an app that gives the attempt
   back itself.

## Progress

- [x] Phase 1: waiting failures (c040f3c, jobs tests 241/241)
