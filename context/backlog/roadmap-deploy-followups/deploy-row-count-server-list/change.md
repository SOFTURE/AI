---
change_id: deploy-row-count-server-list
title: "deploy.sh takes the row-count tables from the app's deploy.json"
status: backlog
roadmap_item: DF-8
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

The server's `deploy.sh` runs `row-counts` with the list in the app's `deploy.json` (DF-5's
`database.rowCountTables`), so adding a key table is a change in the app's repository that ships with its release,
not an edit of the generated script on the server.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-8**:

> - **Outcome:** the release ships `deploy.json` with the server files (DF-7); `init`'s `deploy.sh` runs
>   `row-counts --config=<shipped deploy.json>` instead of `--tables="$ROW_COUNT_TABLES"`, and `init --tables`
>   writes `database.rowCountTables` into the generated `deploy.json` instead of the script.
> - **Source:** DF-5 (`deploy-row-count-config`), research question 3: the server holds `docker/prod/` and
>   `deploy.sh` only, so `deploy.sh` cannot read `deploy.json` until DF-7 ships the app's files with each release.

## Constraints

- Touches `tools/deploy/templates/docker/server/deploy.sh.tmpl`, `templates/deploy.json.tmpl` and `src/init/`; runs
  after DF-7, which owns `deploy.sh` and the shipped files.
- The first release still has no rows to compare; an app without a list skips the comparison as today.
