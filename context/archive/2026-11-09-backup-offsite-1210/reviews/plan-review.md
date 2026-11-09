---
change_id: backup-offsite-1210
verdict: approved
---

# Plan review (auto)

- Scope matches #1210 point by point: encrypt (age, public key only on the server), upload (any S3, write-only
  token, single PUT), retention (lifecycle rule, the night never deletes), status (table + `getLastBackup` + metrics +
  logs), restore (new database by default, `--overwrite` explicit, identity from file or stdin), verify (temporary
  database, schema guard, row counts, drop), config (env, zod, not configured skips).
- One deviation is recorded: verify is scheduled outside `maintain`, because the issue's own first rule (the private
  key never reaches the server) rules out decrypting there. The issue's "e.g. weekly from maintain" is an example,
  not a requirement; the README and an example workflow cover the weekly schedule.
- Storage choice is justified (the only store both sides reach) and degrades to a warning when the app has not added
  the module.
- Risk: own SigV4. Mitigated by AWS's published example vector and by the MinIO run in CI.
- Risk: maintain time. The unconfigured path reads one line of `.env.prod`; the configured path is bounded by the
  upload. Approved.
