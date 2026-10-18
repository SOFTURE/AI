---
change_id: waitlist-retry-after-580
title: "waitlist: WaitlistFormState carries retryAfterSeconds on security.rate_limited (issue #580)"
status: in_progress
roadmap_item: null
issue: 580
branch: claude/project-thread-w3rtzl
created: 2026-10-18
updated: 2026-10-18
---

## Intent

Close [issue #580](https://github.com/SOFTURE/AI/issues/580): when `joinWaitlistAction` is refused by the rate
limit, `@softure-ai/security` says how long to wait (`retryAfterSeconds`), but `WaitlistFormState` keeps only the
code `security.rate_limited`. The form cannot tell the person when to try again, so an adopting app keeps its own
action just to carry that value.

## Context

Labels: `bug`, `pkg: waitlist`, `adoption`. waitlist 0.3.1 is the latest on npm and on master. Releases are batched
by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`. Issue #579 changes waitlist in a
parallel thread; master is merged in before the merge.

## Acceptance

- A rate-limited submission returns a state with `retryAfterSeconds` equal to the limiter's value.
- Other error states are unchanged.
- `WaitlistForm` shows the wait in its default message; the copy stays overridable through `messages`.

## Notes

- Framing: skipped. The issue states the problem, the proposal and the acceptance.

## Decisions (auto)

- `retryAfterSeconds` is an optional field on the existing `WaitlistFormState` interface, set only with
  `error: "security.rate_limited"`, instead of turning the state into a discriminated union: the state is already a
  bag of optional echo fields read by apps, and a union would be a breaking type change for a bug fix.
- New copy `form.retryAfter` ("Too many attempts. Try again in {minutes} min."), with minutes rounded up and at
  least 1. "min" does not inflect, so no plural forms are needed (same as blog's `readingTime`). Without the value
  (an older server, an app's own action) the form keeps `errors.security.rate_limited`.
- The confirmation page's `limited` status is out of scope (the issue names the form state only).
