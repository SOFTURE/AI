---
change_id: privacy-copy-drizzle-ledger-572
reviewed: 2026-10-18
verdict: approved
---

# Implementation review: privacy-copy-drizzle-ledger-572

Checked commits 8380f90 and a436dd8 against plan.md and issue #572.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Acceptance 1: the new test adds a target-only drizzle migration with an equal module ledger; the copy refuses with `copy_ledger_mismatch`, names it, and `findTraces` shows nothing written. It failed before the change. | No change. |
| 2 | Check | Acceptance 2: every earlier test runs without a `drizzle` schema and still passes (15 of 15). | No change. |
| 3 | Check | Ledger table names reach SQL only through `sql.identifier`; the schema is a constant. The reads run inside the existing source (read-only) and target transactions, so a refusal still writes nothing. | No change. |
| 4 | Minor | A `created_at` of NULL (not written by drizzle) is keyed `#null`; two such rows in one table would collapse into one key. drizzle always writes `folderMillis`, so this needs a hand-edited ledger. | Accepted, no code for it. |

No Critical or Major findings.
