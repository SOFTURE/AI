---
change_id: waitlist-opt-out-guard
title: "waitlist: a sign-up without double opt-in never lifts an opt-out (issue #237)"
status: planned
roadmap_item: null
issue: 237
branch: claude/project-thread-uu5ivf
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Without double opt-in, `joinWaitlist` lifts the address's own opt-out (`liftSuppression`) for whoever types the
address into the public form. Anyone can then put a person who unsubscribed back on the list, and the next
campaign and the welcome mail go to them. The re-consent is not provably theirs
([#237](https://github.com/SOFTURE/AI/issues/237)).

After this change, without double opt-in, a sign-up of an address on mailing's suppression list writes nothing
and returns a distinct outcome (`status: "suppressed"`); the form action answers it exactly like a sign-up that
counted, so the answer does not reveal who unsubscribed. With double opt-in nothing changes: the confirmation link
proves control of the mailbox, and `confirmSignup` keeps lifting the opt-out.

A reviewer checks the new tests in `modules/waitlist/tests/`, the README sections on unsubscribes and the import,
the CHANGELOG and the version bump (waitlist 0.1.8).

## Context

- `joinNow` (no double opt-in) calls `liftSuppression` for a new row and, through `applyRequest`, for a known row.
  `confirmSignup` (double opt-in) uses the same `applyRequest`.
- `importSignups` records a `page` opt-out for an unsubscribed row, documented as "an opt-out their next sign-up
  lifts". That stays true with double opt-in only.
- Mailing exports `isSuppressed(ctx, address)` (any source) and `liftSuppression` (own sources only). An adopting
  app works around the bug today by calling `isSuppressed` before `joinWaitlist`.

No roadmap: issues are the tracker (project rule 2026-10-07).

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Only `@softure-ai/waitlist` changes (no mailing release needed). Bumps it 0.1.7 → 0.1.8; the thread releases it
  after the merge if no other open change touches waitlist.
- The form's answer must not tell a suppressed address from one that counted (no enumeration of opt-outs).

## Process notes

- Research: skipped as a separate artefact. The issue names the function and file; the reading needed (one file,
  the action, mailing's two suppression functions, the import's documented promise) fits in `plan.md` § Findings.
- Framing: done inline in `plan.md` § Key decisions (D1 weighs the issue's two options); the problem itself is not
  in doubt.
