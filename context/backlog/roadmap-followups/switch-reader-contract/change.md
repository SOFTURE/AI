---
change_id: switch-reader-contract
title: "Switch-reader contract in core"
status: backlog
roadmap_item: FU-1
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A switch-reader contract in `@softure-ai/core`: feature-switches provides it, auth asks it with a fallback to its option through an async `isRegistrationClosed(ctx)`, so `auth.registration_closed` flipped in the switches panel takes effect; a report of manifest switches the app did not define.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **FU-1** (roadmap `followups`, main since 2026-10-03):

> ### FU-1: Switch-reader contract in core
> - **Change ID:** `switch-reader-contract`
> - **Status:** proposed
> - **Outcome:** A switch-reader contract in `@softure-ai/core`: feature-switches provides it, auth asks it with a fallback to its option through an async `isRegistrationClosed(ctx)`, so `auth.registration_closed` flipped in the switches panel takes effect; a report of manifest switches the app did not define.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** How the reader is registered (config registry vs. module manifest); whether reads stay one per request in Next.
> - **Risk:** HIGH: must land before FIRE_TRACKER adopts the switches, whose registration switch is flipped from its panel.
> - **Baseline:** identity ID-6 `feature-switches`: auth reads `auth.registration_closed` from its own option and `SOFTURE_SWITCH_AUTH_REGISTRATION_CLOSED`, not through `@softure-ai/feature-switches`, because feature-switches depends on auth (the panel's role check) and auth cannot import it back. After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-14.
> - **Source:** `modules/auth/src/server/switches.ts`, `modules/feature-switches/README.md`

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/auth/` switch reading, `modules/feature-switches/` provider, `foundation/core/` contract.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
