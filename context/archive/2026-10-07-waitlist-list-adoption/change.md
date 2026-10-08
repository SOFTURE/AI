---
change_id: waitlist-list-adoption
title: "waitlist: adopting an existing sign-up list (import with history, consent proof, channel, unsubscribe link after sign-up) (issue #214)"
status: archived
roadmap_item: null
issue: 214
branch: claude/project-thread-3tjgl9
created: 2026-10-07
updated: 2026-10-07
archived_at: 2026-10-07
---

## Intent

Close every point of [issue #214](https://github.com/SOFTURE/AI/issues/214), so an app with a live sign-up list can
move it onto `@softure-ai/waitlist` without losing history:

1. an idempotent import of existing sign-ups (original sign-up time, scopes mapped from the app's own scope names,
   placement, locale, the original `id`), as a server function and an ops script, that never narrows scopes;
2. consent evidence with its historical time and document version for imported rows, and the opt-out of rows that
   unsubscribed, with its time;
3. the acquisition channel of a sign-up, kept per sign-up, filled at join time and on import;
4. the person's own unsubscribe link in the success result of the join action, when the app asks for it.

A reviewer checks the waitlist tests (import, channel, unsubscribe link, form), the privacy consent tests, migration
`0003`, the READMEs and the CHANGELOGs.

## Context

Issue #214, filed while an adopting app planned its switch to the packages. Unsubscribe link forms are covered by #211
and the delivery ledger by #212 (both in `@softure-ai/mailing`, being changed in parallel). Work is tracked in GitHub
Issues: no roadmap item; the PR closes the issue.

## Constraints

- Scope: `modules/waitlist` and `modules/privacy` (a consent with a past time needs a privacy entry point). No change in
  `modules/mailing`: two other threads change it now. The waitlist uses only what mailing already exports
  (`buildUnsubscribeLinks`, `signRecipientKey`, `unsubscribe`, `readUnsubscribeSecrets`).
- Migrations move forward only and say how to roll back.
- The unsubscribe link is a credential: it never reaches a log or an error.
- English-only code and docs; Polish copy only in `messages/pl.ts`.

## Process notes

- Research: skipped as a separate file. The issue names each gap, and the reading of the waitlist sources
  (`signups.ts`, `unsubscribe.ts`, `actions.ts`, migrations 0001-0002), privacy's `consents.ts` (its internal
  `insertConsent` already takes a time), mailing's `unsubscribe-link.ts` and `suppressions.ts`, and billing's
  `import-entitlements` script (the precedent the issue cites) answered every unknown; the findings are in plan.md's
  "Today" section.
- Framing: skipped. Each point is an observed adoption gap with the fix the adopter suggested; the only open choice
  (where the opt-out time lives) is settled in the plan.
