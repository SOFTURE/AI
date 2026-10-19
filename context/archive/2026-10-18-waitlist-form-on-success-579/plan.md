---
change_id: waitlist-form-on-success-579
status: archived
---

# Plan: WaitlistForm onSuccess and success view (issue #579)

Input: change.md, research.md. Complexity: small (one component, tests, docs).

## Phase 1: the props (TDD)

Files: `modules/waitlist/src/contract.ts`, `modules/waitlist/src/ui/waitlist-form.tsx`, `modules/waitlist/src/ui/index.ts`,
`modules/waitlist/src/next/waitlist.tsx`, `modules/waitlist/tests/waitlist-form.test.tsx`.

1. Tests first:
   - `onSuccess` is called exactly once with the `ok` state (incl. `unsubscribeUrl`), and with the `confirmation_sent` state;
     never for an error answer;
   - `success` as a node replaces the default notice; as a function it gets the state;
   - focus can move to the app's view from `onSuccess` (the view is in the DOM when it runs);
   - without the props the default notice stays (the existing tests).
2. `WaitlistFormSuccessState` (the state with `status: "ok" | "confirmation_sent"`) in the contract; `onSuccess` and
   `success` on `WaitlistFormProps`; the effect with a ref; the default view moved into a small function.
3. `<Waitlist success={node} />` passes it through.

## Phase 2: docs

`modules/waitlist/README.md` (the props, the server/client note), `CHANGELOG.md` `## Unreleased` with the app's migration.

## Progress

- [x] Phase 1: the props (TDD) (12e07c8; 7 tests, 6 red before the change; 188 of 188 waitlist tests pass)
- [x] Phase 2: docs (eee9b20; README success view and client example, CHANGELOG `## Unreleased` with the migration)
