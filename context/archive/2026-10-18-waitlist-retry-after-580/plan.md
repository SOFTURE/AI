---
change_id: waitlist-retry-after-580
status: archived
---

# Plan: retryAfterSeconds in the waitlist form state (issue #580)

Input: change.md, research.md. Complexity: small (one field, one action branch, one message, tests, docs).

## Phase 1: carry and show the wait (TDD)

Files: `modules/waitlist/src/contract.ts`, `src/next/actions.ts`, `src/ui/waitlist-form.tsx`, `src/messages/en.ts`,
`tests/next-join.test.tsx`, `tests/waitlist-form.test.tsx`, `tests/messages.test.ts`.

1. Tests first:
   - the action, over the client limit (`waitlist` limit 1, 15 minutes): the second submission answers
     `{ status: "error", error: "security.rate_limited", retryAfterSeconds: 900, email, scopes }`;
   - the action's other refusals (`waitlist.email_invalid`) carry no `retryAfterSeconds`;
   - the form with `retryAfterSeconds: 61` shows "Try again in 2 min." from `form.retryAfter`, with 30 it shows
     1 min; without the value it shows `errors.security.rate_limited` (existing test); an app override of
     `form.retryAfter` is used.
2. `contract.ts`: `readonly retryAfterSeconds?: number` on `WaitlistFormState`, documented.
3. `actions.ts`: add `retryAfterSeconds` when `result.error === "security.rate_limited"`.
4. `en.ts`: `form.retryAfter`. `waitlist-form.tsx`: a pure `getRetryMinutes` and `formatMessage` for the
   form-level message when the state has the value.

## Phase 2: docs

`modules/waitlist/README.md` (form state, Copy), `CHANGELOG.md` `## Unreleased` with the migration for an app that
kept its own action to carry the value, and for an app with its own translation (add `form.retryAfter`).

## Progress

- [x] Phase 1: carry and show the wait (3 tests written first; 184 waitlist tests pass; 4ae0d84)
- [x] Phase 2: docs (README form state and Copy, CHANGELOG `## Unreleased` with the migration)
