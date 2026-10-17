---
change_id: deploy-verify-backup-561
---

# Research: verify-backup in maintain (issue #561)

## Where things are

- `tools/deploy/templates/docker/server/deploy.sh.tmpl`: `maintain` runs `settings`, `backup` (database only),
  `images`, the maintain hooks. `back_up_database` leaves the dump's file name in `backup_file`; compose-exec writes
  the dump through `pg_dump` in the postgres service, host mode through the CLI with `DATABASE_URL`.
- `count_rows` counts `database.rowCountTables` of `$release_config` (host: CLI over `DATABASE_URL`; compose-exec:
  `--print-query` → `psql` in the service → `--stdin`). `row-counts` refuses `--tables` together with `--config`.
- `src/cli/server-settings-command.ts` turns deploy.json into one file per setting for the shell
  (`exclude-table-data` is a comma list already).
- `src/verify/schema.ts`: `databaseSchema` (strict), `BUILT_IN_STEP_NAMES` (hook names must not take a step's name).
  `schema/deploy.schema.json` is generated from it (`scripts/write-schema.ts`), and a test keeps them equal.
- `tests/server-files.test.ts` runs the generated script with stub `docker`, `npx`, `crontab`, `flock`; the stub
  `npx` runs the real CLI for `server-settings` and `--print-query`.

## Facts that shape the design

- The official postgres image trusts local socket connections, which compose-exec's `pg_dump --no-password` relies on;
  `pg_restore` in the same service works the same way in both access modes.
- `pg_restore` reads a custom-format dump from stdin (sequentially), so `compose exec -T postgres pg_restore < file`
  needs no copy into the container.
- A custom-format dump made with `--exclude-table-data` restores those tables empty: their counts would read 0.
- `DROP DATABASE … WITH (FORCE)` needs Postgres 13; an app may keep an older major from its own compose file, and
  nothing else connects to the throwaway database, so a plain `DROP DATABASE IF EXISTS` is enough.
- Rows change between the dump and any later count; counting right before the dump and requiring the restore to hold
  at least as many rows is the deploy's existing rule for counter tables.
- The maintain cron runs daily at 03:17; a weekly verify keys off `date +%u` (7 = Sunday). Tests need a stub `date`.
