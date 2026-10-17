---
change_id: deploy-verify-backup-561
status: in_progress
---

# Plan: verify-backup in maintain (issue #561)

Input: change.md, research.md. Complexity: medium (schema, CLI settings, shell step, tests, docs).

## Phase 1: settings (TDD)

Files: `src/verify/schema.ts`, `schema/deploy.schema.json`, `src/cli/server-settings-command.ts`,
`src/cli/server-settings-command.test.ts`, `src/cli/db-commands.ts`, `tests/db-cli.test.ts`.

1. Tests first: `planServerSettings` writes `verify-backup` (`weekly` by default, the configured value otherwise) and
   `verify-tables` (rowCountTables less excludeTableData, comma list, empty when none are left).
2. `database.verifyBackup: "weekly" | "daily" | "never"`; `verify-backup` joins `BUILT_IN_STEP_NAMES`; regenerate the
   JSON schema.
3. Neutral failure line of `row-counts --compare`.

## Phase 2: the step in deploy.sh (TDD)

Files: `templates/docker/server/deploy.sh.tmpl`, `tests/server-files.test.ts`.

1. Tests first (stub `date` for the weekday, stub docker answering `pg_restore` and the counts): verify day in host
   mode counts before the backup, restores the new dump into `softure_verify_backup`, compares, drops, prints
   `step|verify-backup|ok|<file>`; not a verify day prints `step|verify-backup|ok|skipped`; `never` and `daily`;
   a failing `pg_restore` fails maintain with `result|failed|verify-backup|…` and still drops the database; fewer
   rows fail; compose-exec mode; excluded tables are not counted.
2. `count_rows` takes the table selector; `verify_backup` and `drop_verify_database` (also from the exit trap).

## Phase 3: docs

`tools/deploy/README.md` (maintain, deploy.json key, disk space), `CHANGELOG.md` `## Unreleased` with the app's
migration steps.

## Progress

- [ ] Phase 1: settings
- [ ] Phase 2: the step in deploy.sh
- [ ] Phase 3: docs
