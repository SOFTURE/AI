---
change_id: auth-invitations-fk-indexes
verdict: approved
---

# Implementation review

Reviewed the diff against `plan.md` and issue #1420.

- **Acceptance 1** (the guard fails without 0008 and passes with it): run on master first, two unindexed rows (the two
  invitation columns); green after the migration. The pinned list of foreign keys makes a new unindexed key fail too.
- **Acceptance 2** (gates): typecheck and lint green; the e2e migration list gains `auth 8
  index_invitations_foreign_keys`, the name the migrator derives from the file name.
- **Data.** Forward only, rollback note in the file, the released 0007 untouched. Plain `CREATE INDEX` inside the
  migration transaction; the table is small.
- **Docs.** README section 5 names 0008 and the indexed foreign keys; CHANGELOG `Unreleased` says how to migrate.

Findings: none.
