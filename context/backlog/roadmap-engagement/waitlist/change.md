---
change_id: waitlist
title: "Waitlist with consent scopes"
status: backlog
roadmap_item: EN-5
branch: null
created: 2026-10-02
updated: 2026-10-02
archived_at: null
---

## Intent

`waitlist.signups` (unique on normalised email) with consent scopes and form placements from config instead of hard-coded CHECK values; widening the consent scope on a repeat sign-up; welcome mail sent after the response through mailing; unsubscribe through EN-2; consent recorded through EN-8; rate-limited public action; a standalone `<WaitlistForm/>` with slots and messages.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md), item **EN-5** (roadmap `engagement`, main since 2026-10-03):

> ### EN-5: Waitlist with consent scopes
> - **Change ID:** `waitlist`
> - **Status:** ready
> - **Outcome:** `waitlist.signups` (unique on normalised email) with consent scopes and form placements from config instead of hard-coded CHECK values; widening the consent scope on a repeat sign-up; welcome mail sent after the response through mailing; unsubscribe through EN-2; consent recorded through EN-8; rate-limited public action; a standalone `<WaitlistForm/>` with slots and messages.
> - **Prerequisites:** EN-1, EN-2, EN-8.
> - **Unknowns:** Whether consent scopes need a DB enum or a validated text column; double opt-in as an option; how placement analytics hand over to the analytics module later.
> - **Risk:** low.
> - **Baseline:** FIRE: the form is embedded in a domain component, scopes are CHECK constraints. After: the example app signs up, widens the scope, receives the welcome mail and unsubscribes (e2e).
> - **PRD refs:** FR-18, NFR-5.

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard),
[`docs/01-module-assessment.md`](../../../../docs/01-module-assessment.md) (source map in FIRE_TRACKER).

## Constraints

- Exclusively owns: `modules/waitlist/` including its migrations, `examples/next-app/e2e/waitlist.spec.ts`.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
