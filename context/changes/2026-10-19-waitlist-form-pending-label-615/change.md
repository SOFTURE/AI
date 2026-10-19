---
change_id: waitlist-form-pending-label-615
title: "waitlist: WaitlistForm's submit button reserves the pending label's width (issue #615)"
status: in_progress
roadmap_item: null
issue: 615
branch: claude/project-thread-fjyw6e
created: 2026-10-19
updated: 2026-10-19
---

## Intent

Close [issue #615](https://github.com/SOFTURE/AI/issues/615). `WaitlistForm` (waitlist 0.5.0) renders its submit
`Button` with `pending` but without `pendingLabel`, swapping the children itself. ui's `Button` only keeps the width of
the longer label (the `data-reserve` grid) and puts the spinner in the label when it gets `pendingLabel`, so the idle
button is narrower than the same button in ui's `ActionForm` and widens on submit.

## Context

Labels: `bug`, `pkg: waitlist`, `adoption`. Follow-up to #593. ui `^0.3.0` (the declared range) already ships
`pendingLabel` (checked in the published 0.3.0 tarball), so no dependency change. Releases are batched by the
coordinator: no version bump, the CHANGELOG gets `## Unreleased`.

## Acceptance

- The idle submit button carries the pending copy as its reserve (`data-reserve`) and shows `messages.form.submit`.
- While pending it shows `messages.form.pending` with the spinner in the label.
- No new props, no copy changes.

## Notes

- Framing: skipped. The issue states the problem and the fix.
- The same gap in auth's forms is filed as #616 (one issue, one change).

## Decisions (auto)

- Take the issue's fix as written: `pendingLabel={messages.form.pending}`, children `messages.form.submit`.
