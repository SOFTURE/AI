---
change_id: privacy-copy-drizzle-ledger-572
reviewed: 2026-10-18
verdict: approved
---

# Plan review: privacy-copy-drizzle-ledger-572

Checked plan.md against change.md, research.md, issue #572 and `copy-account.ts`.

| # | Severity | Finding | Decision |
|---|---|---|---|
| 1 | Check | Both acceptance points are tested: a target-only drizzle migration refuses and writes nothing; no `drizzle` schema behaves as today (every existing test runs without it). | No change. |
| 2 | Check | Keying by `created_at` relies on drizzle writing `folderMillis`; the same journal gives equal keys on both sides, and a re-generated migration shows as a checksum difference. | No change. |
| 3 | Major | Table names come from the catalog and go into SQL; they must be quoted as identifiers, never interpolated raw. | Plan step 2: use `sql.identifier`. |
| 4 | Check | `drizzle` present on one side only: every row of the other side is a difference, which is the right refusal (the target lacks or adds app migrations). | No change. |

No Critical findings.
