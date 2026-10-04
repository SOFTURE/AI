---
change_id: billing-reminder-mail
title: "An account gets a reminder mail before its access ends and when it has ended"
status: new
roadmap_item: FU-6
branch: claude/fu-6-3xpjg4
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

An app with billing and mailing can send each account a reminder mail when its trial or dated paid
access enters the reminder window, and one when that access has ended, next to the in-app notice
billing already shows. Each mail goes out at most once per window through mailing's delivery
ledger, also when the run repeats or two runs overlap. Billing ships the run as a server function
(and a way to call it from a script); scheduling it stays with the app. Unit tests and the example
app's e2e cover it.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-6).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-6** (roadmap `followups`):

> - **Outcome:** A reminder mail before an account's trial or paid access ends (and when it has ended), sent once per window through mailing's delivery ledger, next to the in-app notice billing already shows.
> - **Prerequisites:** FU-9 on `master` (shared files, see Order).
> - **Unknowns:** What triggers the run (a scheduled script through ops vs. a request-time check); how accounts in a window are found without scanning every account (accounts without a row derive their trial from `auth.users.created_at`).
> - **Risk:** LOW.
> - **Baseline:** monetization MO-1 `billing-entitlements`: the reminder windows only drive the in-app badge and notice; no mail is sent (README §12). After: the gap is closed and covered by unit and e2e tests.
> - **PRD refs:** FR-22.

The roadmap's owner assessment (Owner at the keyboard?): "a mail through mailing's delivery ledger
and fake provider; the module ships a run function, scheduling stays with the app".

Today `modules/billing/README.md` §12 says "No reminder mail: the notice shows in the app only
(followups FU-6)". `resolveEntitlement` already computes the reminder window (`trial.reminderDays`,
`paid.reminderDays`); mailing's `deliverOnce(ctx, { scope, mail })` gives exactly-once delivery per
scope and recipient (`modules/mailing/src/server/deliveries.ts`).

## Constraints

- Owns `modules/billing/` reminder mail (code, messages, README), the example app's wiring of it,
  and the e2e that covers it.
- Lane C (billing): FU-20, FU-21, FU-22 follow in `modules/billing/`; none of them is done here.
  Other gaps found go to the followups roadmap as new FU items, not fixed here.
- English-only code, comments and commits (AGENTS.md). User-facing copy only in the `pl`/`en`
  message dictionaries.
- No release, tag or publish (owner).

## Notes

- Framing skipped: the gap is recorded with a stated outcome and an owner assessment (a run
  function, scheduling with the app), so the problem itself is not in doubt; research answers the
  two unknowns.
