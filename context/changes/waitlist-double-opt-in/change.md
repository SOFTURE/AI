---
change_id: waitlist-double-opt-in
title: "A waitlist sign-up can wait for the address owner's confirmation"
status: plan_reviewed
roadmap_item: FU-2
branch: claude/project-thread-mepk9s
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

An app can turn on double opt-in for its waitlist (`waitlist({ doubleOptIn })`, off by default).
With it on, a sign-up is stored as unconfirmed and the address gets a mail with a single-use
confirmation link. Until the link is used, the address is not on the list: no consent row in
`privacy.consents`, no list mail (welcome or launch), no lifted opt-out, and `listSignups` leaves it
out. Using the link records the consents, lifts the person's own opt-out, counts the sign-up and
sends the welcome mail. Unconfirmed sign-ups expire after a configurable time. With the option off,
a sign-up counts at once, as today. Unit tests and the example app's e2e cover both paths.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-2).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-2** (roadmap `followups`):

> - **Outcome:** Double opt-in as a waitlist option: a `confirmed_at` column, a signed confirmation link in the welcome mail, and list mail and consent rows that wait for the confirmation when the option is on.
> - **Unknowns:** Whether consent rows are recorded at sign-up and confirmed later or only at confirmation; expiry of unconfirmed sign-ups.
> - **Risk:** MEDIUM: without it a typo or a third party's address joins the list at once.
> - **Baseline:** engagement EN-5 `waitlist`: a sign-up counts at once (README §12). After: the gap is closed and covered by unit and e2e tests.

Today: `joinWaitlist()` (`modules/waitlist/src/server/signups.ts`) stores the sign-up, lifts the
address's own mailing opt-out (FU-3) and records the consents in one transaction; the join action
then sends the welcome mail (`deliverWelcomeMail`). The roadmap's owner assessment: "an opt-in
waitlist option (off by default), so no product decision; expiry is a configurable default".

## Constraints

- Owns `modules/waitlist/` (code, migrations, README), the example app's waitlist config and
  confirmation page, and `e2e/waitlist.spec.ts` (plus the waitlist line of `e2e/migrations.spec.ts`).
- Lane B: FU-4 (HTML welcome mail) and FU-8 (funnel hook) follow in `modules/waitlist/`; neither is
  done here. Other gaps found go to the followups roadmap as new FU items.
- No release, tag or publish (owner).

## Notes

- Framing skipped: the problem is a recorded gap with a stated outcome and an owner assessment
  (option off by default, no product decision); research answers the two unknowns.
- From FU-3: with double opt-in, the lift of the opt-out and the scope replacement belong to the
  confirmation, not to the unconfirmed sign-up (`backlog-input.md`, Notes).
