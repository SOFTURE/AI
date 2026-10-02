---
change_id: privacy-registry
title: "GDPR export and deletion registry"
status: backlog
roadmap_item: EN-7
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

A contributor contract in `@softure-ai/privacy` that every module and the app use to register `export(userId)` and `delete(userId)`; a JSON export endpoint and a self-service account deletion flow (confirmation, transaction across contributors, session cleanup); the already released identity modules register their contributors.

## Context

From [`roadmap-engagement.md`](../../../foundation/roadmaps/roadmap-engagement.md), item **EN-7** (queued roadmap `engagement`):

> ### EN-7: GDPR export and deletion registry
> - **Change ID:** `privacy-registry`
> - **Status:** ready
> - **Outcome:** A contributor contract in `@softure-ai/privacy` that every module and the app use to register `export(userId)` and `delete(userId)`; a JSON export endpoint and a self-service account deletion flow (confirmation, transaction across contributors, session cleanup); the already released identity modules register their contributors.
> - **Prerequisites:** roadmap-identity done (auth released).
> - **Unknowns:** Ordering of delete contributors with foreign keys across schemas; whether some contributors may veto deletion (e.g. legal retention) and how that is shown; export size limits.
> - **Risk:** high. Deleting data wrongly is irreversible.
> - **Baseline:** FIRE lists tables by hand and deletes accounts only from a CLI. After: export contains every registered contributor's data, deletion leaves no rows for the user in any module schema (verified by a test that scans all schemas).
> - **PRD refs:** FR-20, NFR-5.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/privacy/` registry, export and deletion, contributor registrations in released modules, `examples/next-app/e2e/privacy-export-delete.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
