---
change_id: waitlist-double-opt-in
title: "Waitlist double opt-in"
status: backlog
roadmap_item: FU-2
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

Double opt-in as a waitlist option: a `confirmed_at` column, a signed confirmation link in the welcome mail, and list mail and consent rows that wait for the confirmation when the option is on.

## Context

From [`roadmap-followups.md`](../../../foundation/roadmaps/roadmap-followups.md), item **FU-2** (queued roadmap `followups`):

> ### FU-2: Waitlist double opt-in
> - **Change ID:** `waitlist-double-opt-in`
> - **Status:** proposed
> - **Outcome:** Double opt-in as a waitlist option: a `confirmed_at` column, a signed confirmation link in the welcome mail, and list mail and consent rows that wait for the confirmation when the option is on.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** Whether consent rows are recorded at sign-up and confirmed later or only at confirmation; expiry of unconfirmed sign-ups.
> - **Risk:** MEDIUM: without it a typo or a third party's address joins the list at once.
> - **Baseline:** engagement EN-5 `waitlist`: a sign-up counts at once (README §12). After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-18, NFR-5.
> - **Source:** `modules/waitlist/README.md` §12

Reference material: [`docs/02-module-standard.md`](../../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/waitlist/` and its migrations folder.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
