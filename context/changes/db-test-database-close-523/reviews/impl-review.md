---
change_id: db-test-database-close-523
reviewed: 2026-10-15
verdict: approved
---

# Implementation review: db-test-database-close-523

Checked the diff against plan.md, change.md and issue #523.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Warning | On the lockfile's PGlite 0.5.8 `close()` already resolves, so the new tests would pass without the fix and guard nothing. | Taken: the lockfile resolves 0.5.10 (inside the existing range), where both tests fail without the fix. |
| 2 | Check | `await client.waitReady` sits in `createPgliteHandle`, so test copies, `pglite://` URLs and an app's own client are all covered. | No change. |
| 3 | Check | A failed PGlite start now rejects at creation instead of at the first query; the error is the same. | No change. |
| 4 | Warning | With 0.5.10 the migrator tests hung too: the test driver dumped a fresh `new PGlite()` before it was ready. | Taken: `tests/support/drivers.ts` awaits `waitReady` before `dumpDataDir`; db and deploy tests green (232 passed). |
| 5 | Check | No public signature changed; CHANGELOG says nothing to migrate. | No change. |

No Critical findings.
