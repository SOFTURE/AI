---
change_id: deploy-row-count-config
title: "The tables row-counts compares come from deploy.json"
status: backlog
roadmap_item: DF-5
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

An app lists the tables `softure-deploy row-counts` compares in its `deploy.json` (DP-4's file), so the generated
`deploy.sh` (DP-5) stays the same for every app; `--tables` still overrides it.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-5** (main roadmap since 2026-10-06):

> - **Outcome:** `deploy.json` gets an optional `database.rowCountTables` list (zod schema and JSON Schema);
>   `row-counts` reads it when `--tables` is not given.
> - **Source:** DP-3 (`deploy-db-guard`), plan review S2: DP-4 owned `deploy.json` while DP-3 ran in parallel, so DP-3
>   takes the list as a flag only.

## Constraints

- Touches the `deploy.json` schema (DP-4) and `tools/deploy/src/db/`.

## Notes

- Source: DP-3 plan review S2 (`deploy-db-guard`).
