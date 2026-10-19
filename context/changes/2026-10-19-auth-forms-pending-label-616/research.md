---
change_id: auth-forms-pending-label-616
---

# Research: pending label in the auth forms (issue #616)

- `modules/auth/src/ui/auth-forms.tsx`: `FormShell` renders `<Button type="submit" fullWidth pending={isPending}>`
  with children `isPending ? pendingLabel : submitLabel`; no `pendingLabel`. `LoginForm`, `RegisterForm`,
  `ChangePasswordForm`, `ForgotPasswordForm` and `ResetPasswordForm` all pass their `messages.<form>.submit` and
  `messages.<form>.pending` to it, so one edit covers all five.
- `foundation/ui/src/ui/button.tsx`: with `pendingLabel` and no `iconLeft`, `Button` renders `PendingAwareLabel`: idle,
  a grid span with `data-reserve={pendingLabel}` around the children; pending, the spinner plus `pendingLabel`,
  reserving the idle text. Without `pendingLabel` the spinner sits before the children and nothing is reserved.
- `foundation/ui/src/ui/action-form.tsx` passes `pendingLabel` and the submit label as children: the reference look.
- The waitlist fix for #615 (`context/archive/2026-10-19-waitlist-form-pending-label-615/` on its branch) is the same
  change; ui 0.3.0 (published) already has `pendingLabel`, so auth's `^0.3.0` range holds.
- Tests: `modules/auth/tests/forms.test.tsx` (happy-dom) finds buttons by their submit copy; the reserve is a CSS
  `::after`, so the accessible name stays the visible label.
