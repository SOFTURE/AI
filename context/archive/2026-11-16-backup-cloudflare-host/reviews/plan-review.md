# Plan review: backup-cloudflare-host

Verdict: approve with the fixes below applied to plan.md.

| # | Severity | Finding | Decision |
|---|----------|---------|----------|
| 1 | Warning | The owner's rule (2026-11-16): one interface, per-host implementations. The plan must not add a reader or a status shape for Cloudflare. | Accepted: the Approach states it; the reader, row and env names are shared, only the producer differs. |
| 2 | Warning | `pg_dump` from a runner is older than the managed server and refuses it. | Accepted: dump to stdout through a `postgres:<major>` wrapper (`BACKUP_PG_DUMP`). |
| 3 | Warning | A dump cut short must never be uploaded. | Accepted: the dump is written to a hidden file and renamed only after pg_dump exits 0; a non-zero exit records `dump_failed`. |
| 4 | Suggestion | Recording with the migrator URL mixes roles. | Accepted as is: the migrator owns `backup.runs`; on the VPS the superuser writes it. Named in the README. |
| 5 | Warning | The database URL must never show in output or the row. | Accepted: `redactSecrets` covers `BACKUP_DATABASE_URL`; a test asserts it. |
