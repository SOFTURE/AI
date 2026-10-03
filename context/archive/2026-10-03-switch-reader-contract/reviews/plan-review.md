# Plan review: switch-reader-contract

Reviewed: plan.md against change.md, research.md and the roadmap item FU-1 (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 2 warning, 1 suggestion.

- Every outcome of FU-1 maps to a plan line: the contract in core (`SwitchReader`, `readSwitch`),
  feature-switches as its provider, auth's async `isRegistrationClosed(ctx)` with the fallback,
  the panel flip taking effect (unit test through a stored row, e2e through the panel), and the
  report of manifest switches the app did not define.
- Both unknowns are answered in research.md §2 with a reason.

### W1 [WARNING] Auth's server API changes shape
**Where:** `isRegistrationClosed` in `@softure-ai/auth/server`
**Problem:** it was `(config, env) => boolean`; it becomes `(ctx, env) => Promise<boolean>`. An app
calling it would get a promise, which is truthy.
**Decision:** Accepted - the roadmap asks for this signature, every package is `0.0.0` and
unreleased, and the only callers are in auth. The README states the async signature, and the
typed `Promise<boolean>` makes a missing `await` in a condition a lint error
(`@typescript-eslint/no-misused-promises`) in apps that use the typed rules.

### W2 [WARNING] The fail mode of the defined switch can open registration
**Where:** feature-switches definition of `auth.registration_closed`
**Problem:** `failMode: "closed"` (the default) reads as off when the database cannot be read, which
opens registration, while auth's own fallback fails closed.
**Decision:** Fixed in the plan - the example defines it with `failMode: "open"`, and both READMEs
recommend it. The default fail mode stays the module's general rule.

### S1 [SUGGESTION] Cache the reader per request in Next
**Decision:** Rejected - auth asks once per page or action (research 2.2); a cache would need
request scope inside `ModuleContext`.
