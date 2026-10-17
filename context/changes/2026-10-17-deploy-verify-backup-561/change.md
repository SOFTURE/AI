---
change_id: deploy-verify-backup-561
title: "deploy: maintain test-restores the backup (issue #561)"
status: archived
roadmap_item: null
issue: 561
branch: claude/project-thread-jj6e89
created: 2026-10-17
updated: 2026-10-17
archived_at: 2026-10-17
---

## Intent

Close [issue #561](https://github.com/SOFTURE/AI/issues/561): `deploy.sh maintain` takes a daily `pg_dump`, but no
dump is ever restored, so a backup that cannot be restored is found only on the day it is needed.

## Context

deploy 0.4.1 is the latest on npm and on master. Another change (#560) also edits the `deploy.json` schema and merges
first: fresh master is merged in before this one merges. Releases are batched by the coordinator: no version bump, the
CHANGELOG gets `## Unreleased`. The generated `deploy.sh` belongs to the app; the migration is described, never applied
to an app's repository.

## Constraints

- A corrupted dump makes `maintain` report a failure (`result|failed|verify-backup|…`).
- Tables in `excludeTableData` are not counted as missing.
- The throwaway database is always dropped, also when the restore fails.
- Both `database.access` modes work; the shell stays bash 3.2 and BSD/GNU neutral.

## Notes

- Framing: skipped. The issue names the problem, the place and the steps.

## Decisions (auto)

- Restore into a throwaway database (`softure_verify_backup`) of the same Postgres, through `pg_restore` in the
  postgres service as its superuser (`POSTGRES_USER`, default `postgres`), in both access modes: the cluster's roles
  and extensions are the ones a real restore meets, and `--exit-on-error` turns any error into a failure.
- The dump verified is the one this maintain run just took (the newest). Its counter-table counts are taken in the
  live database right before the dump, so "at dump time" needs no file kept next to each backup; the restored
  counts must not be lower (the same rule as the deploy's row counts).
- `database.verifyBackup`: `"weekly"` (default, the Sunday run), `"daily"` or `"never"`.
- `row-counts --compare`'s failure line becomes neutral ("lost rows or tables"), since a restore uses it too.
