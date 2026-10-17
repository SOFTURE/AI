---
change_id: deploy-verify-backup-561
status: archived
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

- [x] Phase 1: settings (0b3081e)
- [x] Phase 2: the step in deploy.sh (3d13b8e)
- [x] Phase 3: docs (6d0f493)

Phase 1 tests were red before `planServerSettings` and the schema changed; the eight new or changed `deploy.sh`
tests were red against the old template. Checked by hand against a real Postgres 16: a dump restores into a
`template0` database with its owners and grants; a dump cut short inside its data or with a corrupted block fails
`pg_restore --exit-on-error`; a grant to a role the server lacks fails it; a table in `--exclude-table-data`
restores empty, and `row-counts --stdin --compare` on the restored snapshot fails a lower count. Gates on the branch:
typecheck, lint, the deploy package's and the repository's tests.
