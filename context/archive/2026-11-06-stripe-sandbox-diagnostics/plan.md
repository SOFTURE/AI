---
change_id: stripe-sandbox-diagnostics
status: done
---

# Plan

1. `e2e.yml`, the stripe-sandbox failure step: print each `error-context.md` and the tail of the listener's log in
   groups.
2. The spec: `waitForCheckoutReturn` wraps the redirect wait; on timeout it throws with the URL and the texts of
   `[role=alert]`, `.FieldError` and error test ids.

## Acceptance

The next red run's log names what Checkout showed. Gates: lint, typecheck, actionlint in CI.

## Progress

- [x] 1, 2 done; CI on the pull request runs the job (it is red on master for an outside reason).
