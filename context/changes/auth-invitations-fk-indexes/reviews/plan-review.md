---
change_id: auth-invitations-fk-indexes
verdict: approved
---

# Plan review

- Scope matches issue #1420: both columns indexed, forward only, rollback note.
- 0007 stays untouched: apps already applied it, and the migrator records applied versions, so an edit would never
  reach them.
- `CREATE INDEX` (not `CONCURRENTLY`) runs inside the migration transaction and briefly locks writes on
  `auth.invitations`; the table holds a handful of rows per app, so this is acceptable.
- The guard test fails without the migration (two rows) and covers every auth table.
- The e2e migration list must gain `auth 8`, or the example e2e fails.

Verdict: approved, no changes.
