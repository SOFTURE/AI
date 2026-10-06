---
change_id: deploy-row-count-server-list
title: "deploy.sh takes the row-count tables from the app's deploy.json"
status: archived
roadmap_item: DF-8
branch: claude/project-thread-9hgldd
created: 2026-10-06
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

The server's `deploy.sh` runs `row-counts` with the list in the `deploy.json` the release shipped (DF-5's
`database.rowCountTables`, shipped since DF-7), so adding a key table is a change in the app's repository that ships
with its release, not an edit of the generated script on the server. `init --tables` writes that list into the
generated `deploy.json` instead of into the script.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-8**:

> - **Outcome:** the release ships `deploy.json` with the server files (DF-7); `init`'s `deploy.sh` runs
>   `row-counts --config=<shipped deploy.json>` instead of `--tables="$ROW_COUNT_TABLES"`, and `init --tables`
>   writes `database.rowCountTables` into the generated `deploy.json` instead of the script.
> - **Source:** DF-5 (`deploy-row-count-config`), research question 3: the server holds `docker/prod/` and
>   `deploy.sh` only, so `deploy.sh` cannot read `deploy.json` until DF-7 ships the app's files with each release.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md). DF-5
([archive](../../archive/2026-10-06-deploy-row-count-config/change.md)) added `--config` to `row-counts`; DF-7
([archive](../../archive/2026-10-06-deploy-server-files/change.md)) ships `deploy.json` in the release archive.

## Constraints

- Touches `tools/deploy/templates/docker/server/deploy.sh.tmpl`, `templates/deploy.json.tmpl`, `src/init/` and their
  tests; DF-3 (workflow e2e) runs in parallel on the workflow file, which this change does not touch.
- The first release still has no rows to compare; a release without `deploy.json` or without the key skips the
  comparison as an empty list does today.
- No real deploy, tag or publish. English-only code, comments and commits. FIRE_TRACKER is read only.

## Notes

- Placement: main roadmap deploy-followups, item DF-8 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done, short ([`research.md`](research.md)): what the server holds per release, how `row-counts --config`
  behaves without the key, and what Node the host has.
- Framing skipped: the roadmap item fixes both the problem (the list is baked into the server's script) and the
  shape of the fix (`--config` on the shipped file); DF-5 and DF-7 built the two halves for exactly this.
- Archived 2026-10-06: `init`'s `deploy.sh` reads `database.rowCountTables` from `releases/<tag>/deploy.json` and runs
  `row-counts --config` on it before and after the switch (no file or key: skipped; unreadable: stops before the
  switch); `init --tables` writes the list into `deploy.json` for apps with a database. Rides `@softure-ai/deploy`
  0.1.3 (unpublished, with DF-7). New gap DF-9 (`deploy-row-count-new-table`): a table created by the same release
  stops it at the count before the switch.
