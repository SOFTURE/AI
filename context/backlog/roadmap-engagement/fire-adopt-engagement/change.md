---
change_id: fire-adopt-engagement
title: "FIRE_TRACKER adopts the engagement modules"
status: backlog
roadmap_item: EN-10
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

Following `docs/05-adoption-playbook.md`, FIRE_TRACKER adopts mailing, waitlist, mcp-access and privacy: its own implementations and unit tests are deleted, existing tables move into the module schemas through `--adopt`, its integration suite stays green, and every gap found becomes an issue in SOFTURE/AI.

## Context

From [`roadmap-engagement.md`](../../../foundation/roadmaps/roadmap-engagement.md), item **EN-10** (queued roadmap `engagement`):

> ### EN-10: FIRE_TRACKER adopts the engagement modules
> - **Change ID:** `fire-adopt-engagement`
> - **Status:** ready
> - **Outcome:** Following `docs/05-adoption-playbook.md`, FIRE_TRACKER adopts mailing, waitlist, mcp-access and privacy: its own implementations and unit tests are deleted, existing tables move into the module schemas through `--adopt`, its integration suite stays green, and every gap found becomes an issue in SOFTURE/AI.
> - **Prerequisites:** EN-9.
> - **Unknowns:** Data migration of existing waitlist rows and delivery history into the module schemas; whether FIRE's domain MCP server fits the factory contract unchanged.
> - **Risk:** high. Production data is moved.
> - **Baseline:** FIRE runs its own copies. After: those copies are gone, FIRE CI is green, CHANGELOG entries say `verified in: FIRE_TRACKER@<sha>`.
> - **PRD refs:** FR-26, G-2.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER), [`docs/05-adoption-playbook.md`](../../../../docs/05-adoption-playbook.md) (adoption steps).

## Constraints

- Exclusively owns: nothing in this repository except the CHANGELOG verification lines; the work happens in FIRE_TRACKER.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
