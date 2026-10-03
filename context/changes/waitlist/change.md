---
change_id: waitlist
title: "Waitlist with consent scopes"
status: in_progress
roadmap_item: EN-5
branch: claude/en-5-waitlist-486z3d
created: 2026-10-03
updated: 2026-10-03
archived_at: null
---

## Intent

`@softure-ai/waitlist` collects sign-ups before a product opens: `waitlist.signups` (one row per
normalised email) with the consent scopes and form placements the app declares in
`waitlist({ scopes, placements })`, not hard-coded CHECK values. A repeat sign-up widens the scopes
and never narrows them. Every scope newly granted is recorded in privacy's consent ledger (EN-8),
in the sign-up's transaction. A welcome mail goes out after the response through mailing's delivery
ledger (at most once per sign-up), as list mail, so it carries mailing's unsubscribe link (EN-2).
The public action is rate limited. `<WaitlistForm/>` in `/ui` is standalone (slots, `unstyled`,
messages), and `/next` wires it to the action in one line.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item EN-5).

## Scope

- Migration `waitlist/0001_create_signups.sql`, Drizzle view, health check, privacy contributor
  (export and deletion of the sign-up of the user's email).
- Options: `scopes` (id, required, document, label per locale), `placements`, `welcomeMail`.
- `/server`: `joinWaitlist`, `deliverWelcomeMail`, `getSignup`, `listSignups`.
- `/next`: `joinWaitlistAction`, the `Waitlist` server component, `getWaitlistMessages`.
- `/ui`: `WaitlistForm`; copy in `en` and `pl`.
- Example app: the module in the config, a form on the home page, `e2e/waitlist.spec.ts`, the
  migration and health lists.

## Out of scope

- Double opt-in (a confirmation link before the sign-up counts): a later option.
- Placement analytics handed to `@softure-ai/analytics` (the placement is stored per sign-up;
  the analytics roadmap reads it).
- Withdrawing a scope from a page of its own, and lifting a mailing suppression when someone
  signs up again after unsubscribing (both need a mailing hook).
