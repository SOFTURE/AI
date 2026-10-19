---
change_id: waitlist-form-pending-label-615
---

# Research: pending label in WaitlistForm (issue #615)

- `modules/waitlist/src/ui/waitlist-form.tsx`: the submit `Button` gets `pending={isPending}` and children
  `isPending ? messages.form.pending : messages.form.submit`; no `pendingLabel`.
- `foundation/ui/src/ui/button.tsx`: with `pendingLabel` and no `iconLeft`, `Button` renders `PendingAwareLabel`: idle,
  a grid span with `data-reserve={pendingLabel}` (and extra padding for the spinner) around the children; pending, the
  spinner plus `pendingLabel`, reserving the idle text (string children only). Without `pendingLabel` the spinner sits
  before the children and nothing is reserved.
- `foundation/ui/src/ui/action-form.tsx` passes `pendingLabel` and the submit label as children: the reference look.
- Published `@softure-ai/ui@0.3.0` already has `pendingLabel` in `dist/ui/button.js`, so waitlist's `^0.3.0` range holds.
- `modules/auth/src/ui/auth-forms.tsx` has the same pattern: out of scope, filed as #616.
- Tests: `modules/waitlist/tests/waitlist-form.test.tsx` (happy-dom) finds the button by name `en.form.submit`; the
  `::after` reserve is CSS, so the accessible name stays the visible label.
