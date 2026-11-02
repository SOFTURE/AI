---
change_id: jobs-wait-sync-item-939
reviewed: 2026-11-02
verdict: approved
---

# Implementation review: jobs-wait-sync-item-939

Reviewed commit c040f3c against plan.md and issue #939.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Minor | A JavaScript caller may pass another `retry` value; it must not skip counting. | Only the exact string `"wait"` takes the new branch; anything else counts as before. No change. |

- Acceptance: a `waitSyncItem` failure leaves the item `pending`, attempts unchanged, `error_code` set, `finished_at`
  null, and the callback's write rolled back (test with the app's own row); five waits at `maxAttempts: 2` never fail
  it and every run gets attempt 1; an item at `maxAttempts - 1` that waits stays pending and the next ordinary failure
  fails it at `maxAttempts`; ordinary failures still count (existing tests).
- `listSyncItems` `errorCode` filter tested with and without `status`.
- README "Sync state for polling" and CHANGELOG `Unreleased` with the migration. No version bump, no migration.
- Gates: typecheck, ESLint, language gate green; jobs tests 241/241.

Verdict: approved.
