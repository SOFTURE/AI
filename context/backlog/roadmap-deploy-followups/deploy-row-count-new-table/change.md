---
change_id: deploy-row-count-new-table
title: "A table can join deploy.json's row-count list in the release that creates it"
status: backlog
roadmap_item: DF-14
branch: null
created: 2026-10-06
updated: 2026-10-06
archived_at: null
---

## Intent

The server's count before the switch runs against the old schema, so a table that the same release creates does not
exist yet and `row-counts` fails the release ("counting rows failed; nothing was restarted"). Since DF-8 the list lives
in the app's `deploy.json`, so a migration and its table in the list in one commit is an easy mistake. `row-counts`
before the switch records a missing table as "not there yet" and the comparison after the switch accepts it, while a
table that existed before and is gone after still fails.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-14**:

> - **Outcome:** a table listed in `database.rowCountTables` that the old schema lacks does not stop the release:
>   the count before the switch notes it as absent, the comparison after the switch prints it as new; a table counted
>   before and missing after still fails.
> - **Source:** DF-8 (`deploy-row-count-server-list`), research question 4.

## Constraints

- Touches `tools/deploy/src/db/row-counts.ts`, `src/cli/db-commands.ts` (the counts file format may need an
  "absent" marker) and their tests; the server script needs no change if `row-counts` handles it.
- Safe today: the release stops before anything restarts; this is a usability gap, not data loss.
