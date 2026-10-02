# Implementation review: auth-password-reset

Reviewed: commits 1dd1834 (p1) and 1077e79 (p2) against plan.md (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 2 warnings, 1 suggestion; all fixed.
Evidence: gates green (typecheck, lint, 1018 unit tests, build); `npm run e2e` on PostgreSQL 16:
31 passed, including the seven tests of `e2e/auth-reset.spec.ts` (also 3 repeats each, no flake).

## Drift from plan

- A successful reset redirects to the login page with `?reset=1` (the login page shows the
  confirmation) instead of returning an `ok` state to the reset form; see W2.
- The reset page's referrer policy is `same-origin`, not `no-referrer`; see W1.
- `ResetPasswordForm` lost its `loginHref` prop and `messages.resetPassword.loginLink` went with it.

## Findings

### W1 [WARNING] `no-referrer` broke the reset form without JavaScript
**Where:** `src/next/pages.tsx`, `ResetPasswordPage`
**Problem:** with `no-referrer` the browser sends `Origin: null` with a plain HTML form post, and
Next refuses the server action ("Invalid Server Actions request"), measured in the no-JS e2e.
**Decision:** Fixed - `same-origin`: no referrer to other sites, the Origin header stays.

### W2 [WARNING] Without JavaScript a successful reset showed "this link does not work"
**Where:** `resetPasswordAction`
**Problem:** a no-JS form post re-renders the page after the action; the page checks the token,
which the action has just consumed.
**Decision:** Fixed - the action redirects to the login page, which confirms the change; both e2e
paths (with and without JavaScript) assert it.

### S1 [SUGGESTION] The e2e helper recursed into itself
**Decision:** Fixed - `expectResetDone` asserts the URL and the status text directly.
