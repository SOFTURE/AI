---
change_id: mailing-consent-sync
title: "An unsubscribe withdraws consent and a new sign-up lifts the suppression"
status: plan_reviewed
roadmap_item: FU-3
branch: claude/project-thread-6u8qf0
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

The consent ledger matches what a recipient receives. When someone unsubscribes through mailing's
link (the page or the RFC 8058 one-click POST), the consents they gave through the waitlist are
withdrawn in `privacy.consents`, in the same transaction as the suppression. When someone signs up
on the waitlist again, the explicit sign-up lifts their own earlier opt-out, so list mail reaches
them again. Both paths are covered by unit tests and by the example app's e2e.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-3).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-3** (roadmap `followups`):

> - **Outcome:** A mailing hook on unsubscribe and on a new explicit consent: an unsubscribe through mailing's link records a withdrawal in `privacy.consents`, and a new explicit sign-up lifts the mailing suppression, so the consent ledger matches what the recipient receives.
> - **Unknowns:** Which module owns the mapping from a mail kind to a consent purpose; whether lifting a suppression needs a fresh consent row in the same transaction.
> - **Risk:** HIGH: today the ledger can show a granted consent for a recipient who unsubscribed.
> - **Baseline:** engagement EN-5 `waitlist`: unsubscribing stops list mail but records no withdrawal, and signing up again does not lift the suppression (README §12).

Today: `unsubscribe()` (`modules/mailing/src/server/suppressions.ts`) inserts into
`mailing.suppressions` and nothing else; `joinWaitlist()` (`modules/waitlist/src/server/signups.ts`)
never reads or clears the suppression.

## Constraints

- Owns `modules/mailing/` (hook and lift), `modules/waitlist/` and `modules/privacy/` wiring, the
  example app's mailing config and `e2e/waitlist.spec.ts`.
- Lane B: FU-2, FU-4 and FU-8 follow in `modules/waitlist/`; none of them is done here.
- No release, tag or publish (owner).

## Notes

- Framing skipped: the problem is a recorded gap with a stated outcome (README §12 of the waitlist,
  EN-5's plan review S1); nothing about what to build is in doubt. Research answers the two unknowns.
