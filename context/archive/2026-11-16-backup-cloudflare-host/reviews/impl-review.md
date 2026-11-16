# Implementation review: backup-cloudflare-host

Reviewed the whole change (phases 1 and 2) against `plan.md`, the RP-9 block and the owner's order that every package
keeps one interface with per-host implementations under it.

## Verdict

Approve. The plan is implemented as written; no finding needs a code change.

## Checks

- **One interface, two producers.** `softure-backup run` reuses `uploadBackups` and `buildStatusSql`, so the object
  keys, the encrypted format, the `backup.runs` row, `getLastBackup()`, the gauges, `restore`, `fetch` and `verify` are
  the VPS ones; nothing host-specific reaches an app's code. The only per-host part is the producer (maintain vs the
  `backup-cloudflare` action).
- **Failure paths.** A failed dump records `dump_failed`; a failed upload records `failed`; a run whose row cannot be
  written exits 1 and says the copy may exist but is not recorded; `not_configured` is recorded and exits 0, as the
  caller workflow's comment says. Covered by `modules/backup/tests/run.test.ts` and the Postgres case in
  `offsite-postgres.test.ts` (run against Postgres 16 locally).
- **Secrets.** The database URL and its decoded password are redacted from every message and summary
  (`collectSecrets`); the pg_dump wrapper passes only libpq variables into the container; the callers run on
  `ubuntu-latest` from their environments and pass every secret by name. `tests/repo/backup-cloudflare-action.test.ts`
  holds the action's contract and also runs on macOS (`macos.yml`).
- **Versions.** backup 0.1.1 (module.json and package.json agree); deploy stays 0.7.1, unpublished, and its CHANGELOG
  lists the new init files. The VPS template pin stays at backup 0.1.0, so VPS apps are unchanged.
- **Gates.** `npx vitest run tools/deploy tests/repo modules/backup`: 2108 passed, 102 skipped; typecheck, ESLint and
  the language gate green; pre-commit green on 57709b2c.

## Findings

None.
