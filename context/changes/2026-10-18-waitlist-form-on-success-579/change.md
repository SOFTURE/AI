---
change_id: waitlist-form-on-success-579
title: "waitlist: WaitlistForm takes an onSuccess callback and a success view (issue #579)"
status: in_progress
roadmap_item: null
issue: 579
branch: claude/project-thread-37fb11
created: 2026-10-18
updated: 2026-10-18
---

## Intent

Close [issue #579](https://github.com/SOFTURE/AI/issues/579): after a sign-up `WaitlistForm` always shows its own
notice, with no callback and no slot for the success view. An adopting app that shows its own confirmation card (and
moves focus to it) keeps a form of its own and duplicates the package's state handling. The form gets `onSuccess` and
`success`, so the app can do that with `WaitlistForm` alone.

## Context

Labels: `enhancement`, `pkg: waitlist`, `adoption`. waitlist 0.3.1 is the latest on master. Releases are batched by
the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`. Issue #580 changes the same form in a
parallel thread (rate-limit message); master is merged in before the merge.

## Constraints

- Existing usage keeps its look and behaviour (no new prop = today's markup).
- English only; copy stays in the messages.

## Notes

- Framing: skipped. The issue states the problem, the proposal and the acceptance.

## Decisions (auto)

- "Success" is both answers that replace the form: `ok` and `confirmation_sent`. `onSuccess` and `success` get the
  state, narrowed to `WaitlistFormSuccessState`, so the app tells them apart by `status` (and reads `unsubscribeUrl`).
- `success` replaces the whole default success view (notice and unsubscribe link) inside the `root` slot; the app's
  view is responsible for the unsubscribe link when it asks for one.
- `onSuccess` runs from an effect after the success view is committed (so focus can move to it), once per answer: a
  ref keeps the last state it was called for, which also covers Strict Mode's double effect.
- `<Waitlist />` (a server component) passes through `success` as a `ReactNode` only: functions cannot cross into a
  client component. An app that needs `onSuccess` or the function form renders `WaitlistForm` from its own client
  component with `joinWaitlistAction`, as the README already describes.
