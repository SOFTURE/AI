---
change_id: billing-reminder-mail
title: "Reminder mail before access ends"
status: backlog
roadmap_item: FU-6
branch: null
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

A reminder mail before an account's trial or paid access ends (and when it has ended), sent once per
window through mailing's delivery ledger, next to the in-app notice billing already shows.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-6** (roadmap `followups`, main since 2026-10-03):

> ### FU-6: Reminder mail before access ends
> - **Change ID:** `billing-reminder-mail`
> - **Status:** proposed
> - **Outcome:** A reminder mail before an account's trial or paid access ends (and when it has ended), sent once per window through mailing's delivery ledger, next to the in-app notice billing already shows.
> - **Prerequisites:** none beyond the main branch.
> - **Unknowns:** What triggers the run (a scheduled script through ops vs. a request-time check); how accounts in a window are found without scanning every account (accounts without a row derive their trial from `auth.users.created_at`).
> - **Risk:** LOW.
> - **Baseline:** monetization MO-1 `billing-entitlements`: the reminder windows only drive the in-app badge and notice; no mail is sent (README §12). After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-22.
> - **Source:** `modules/billing/README.md` §12

Reference material: [`docs/02-module-standard.md`](../../../docs/02-module-standard.md) (the standard).

## Constraints

- Exclusively owns: `modules/billing/` reminder mail.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in `pl`/`en` message dictionaries.
- No release, tag or publish by the agent; the owner tags releases.

## Notes
