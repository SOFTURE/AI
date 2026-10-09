---
change_id: waitlist-unsubscribe-link-new-only
title: "waitlist: the join action gives the unsubscribe link only to the request that created the sign-up (issue #306)"
status: archived
roadmap_item: null
issue: 306
branch: claude/project-thread-fbt20l
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

With `waitlist({ unsubscribeLinkOnSuccess: true })`, `joinWaitlistAction` returned `unsubscribeUrl` for every answer
without double opt-in, including an address already on the list and a suppressed one. Anyone could type another
person's address into the public form and receive that person's signed unsubscribe link, then opt them out of the
list and, through mailing's shared suppression, out of all list mail
([#306](https://github.com/SOFTURE/AI/issues/306)).

After this change only the request that created the sign-up (`status: "joined"`, `isNew: true`) gets the link. A known
and a suppressed address are answered alike, `{ status: "ok" }` without a link.

A reviewer checks `modules/waitlist/src/next/actions.ts`, the tests in `modules/waitlist/tests/next-join.test.tsx`,
the README, the CHANGELOG and the version bump (waitlist 0.1.9).

## Context

- `joinWaitlist` returns `joined` with `isNew`, `confirmation_required`, or `suppressed` (0.1.8, #237).
- An adopting app works around the leak with its own action that gives the link only for `isNew`.

## Constraints

- A known and a suppressed address must keep answering alike, so the form does not tell who unsubscribed.
- No change to `joinWaitlist`, the form or the contract's shape.

## Notes

- `research` skipped: the issue names the line and the fix; the code read is recorded in the plan.
- `frame` skipped: the problem is a confirmed leak, not in doubt.
