---
change_id: deploy-row-count-config
title: "The tables row-counts compares come from deploy.json"
status: archived
roadmap_item: DF-5
branch: claude/project-thread-32zvsg
created: 2026-10-05
updated: 2026-10-06
archived_at: 2026-10-06
---

## Intent

An app lists the tables `softure-deploy row-counts` compares once, in its `deploy.json` (DP-4's file), under an
optional `database.rowCountTables`. `row-counts` without `--tables` reads that list; `--tables` still names the
tables on the command line. A reviewer can check it with the package tests: the schema accepts and refuses lists,
the JSON Schema is regenerated, and the CLI counts the configured tables on a real Postgres.

## Context

From [`roadmap.md`](../../foundation/roadmap.md) (deploy-followups), item **DF-5**:

> - **Outcome:** `deploy.json` gets an optional `database.rowCountTables` list (zod schema and JSON Schema);
>   `row-counts` reads it when `--tables` is not given.
> - **Prerequisites:** DP-4 (`deploy.json`) on `master`.
> - **Risk:** low. A convenience; `--tables` works without it. Mode: autonomous, no owner step.
> - **Source:** DP-3 (`deploy-db-guard`), plan review S2: DP-4 owned `deploy.json` while DP-3 ran in parallel.

The taken backlog entry is kept as [`backlog-input.md`](backlog-input.md).

## Constraints

- Owns `tools/deploy/src/db/`, the `row-counts` command in `src/cli/db-commands.ts`, and the `database` key of
  `src/verify/schema.ts` and `schema/deploy.schema.json`. DF-6 adds `verify.tlsMinDays` to the same schema in
  parallel: the second to merge takes `master` and regenerates the JSON Schema.
- `init`'s `deploy.sh` stays as it is: DF-7 owns it (lane A), and the server has no `deploy.json` until DF-7 ships
  the app's files with each release.
- English-only code, comments and commits (AGENTS.md). No tag or publish; the owner releases.

## Notes

- Placement: main roadmap deploy-followups, item DF-5 (taken from `context/backlog/roadmap-deploy-followups/`).
- Research: done (`research.md`), short: where `deploy.json` is read and what the server sees.
- Framing skipped: the problem and its shape are fixed by the roadmap item (DP-3's plan review deferred exactly this
  key); nothing about whether to build it is in doubt.
- Gap DF-8 (`deploy-row-count-server-list`) queued in `deploy-followups`: `deploy.sh` and `init` move onto the list
  once DF-7 ships `deploy.json` to the server.
- Archived 2026-10-06: `@softure-ai/deploy` 0.1.2 reads `database.rowCountTables`; waiting for its next publish.
