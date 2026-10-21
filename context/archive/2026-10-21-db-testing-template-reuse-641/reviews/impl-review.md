---
change_id: db-testing-template-reuse-641
reviewed: 2026-10-21
verdict: approved
---

# Implementation review: db-testing-template-reuse-641

Checked the diff against change.md (acceptance), plan.md and issue #641.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance: global setup export, disk key from file contents, custom hooks per file without `templateKey`, reuse with restore and fresh copy on schema change, default unchanged (`testing.test.ts` untouched and green), context-only pre-push skip, repo wiring, docs. | Met. |
| 2 | Major | `closeReusedTestDatabases` cleared the pools, but a database held at that moment would later be pushed into an orphaned pool and never closed. | Pools are marked retired; a database returned to a retired pool is closed. Tested. |
| 3 | Minor | A drizzle hook's folder is known only through a `WeakMap` in the module instance that created it; a hook from another instance looks custom. | Same as the ledger check (#534); in a test file both come from one instance. Documented in the test. |
| 4 | Minor | Restore failures are swallowed. | Deliberate: a database a test broke is replaced by a fresh copy, which is the expected outcome; commented. |
| 5 | Check | `tryRestore` runs `DISCARD ALL` first, so an open transaction fails the reset and the instance is replaced (tested). | No change. |
| 6 | Check | The bin fails closed: no upstream, empty range, git error all run the jobs (tested). A merge bringing in code is compared as trees (tested). | No change. |
| 7 | Check | Language gate, typecheck, lint and build green; no Polish outside dictionaries. | No change. |

No Critical findings.
