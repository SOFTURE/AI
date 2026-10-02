# Implementation review: auth-roles

Reviewed: commits 632b727 (p1) and e1cbdb1 (p2) against plan.md (author's review, `--auto`).
Verdict: approve. Findings: 0 critical, 1 warning, 2 suggestions; all fixed.
Evidence: gates green (typecheck, lint, 989 unit tests, build); `npm run e2e` on PostgreSQL 16:
24 passed, including the five tests of `e2e/auth-roles.spec.ts`.

## Drift from plan

- The plan named only `grant-role` for the example; `revoke-role` was added too (one more line
  file), so the e2e proves that a revoke closes the panel on the next request.
- `role-checks.test.ts` (unit tests of `requireRole`, `authorizeRole`, `hasRole` with Next's request
  scope stubbed) was added on top of the e2e: the fail-closed cases run without a browser.

## Findings

### W1 [WARNING] The action refusal test could pass on a stale message
**Where:** `examples/next-app/e2e/auth-roles.spec.ts`, refusal test
**Problem:** the second submit (anonymous) checked for the same error text the first submit had
already put on the page, so it would pass even if the second call succeeded.
**Decision:** Fixed - each submit waits for the action's POST answer before the assertion, and the
test checks in the database that nothing was written.

### S1 [SUGGESTION] The skills installer rewrote `.gitignore` whitespace
**Decision:** Fixed - the file is restored to master's content; it is not part of this change.

### S2 [SUGGESTION] `hasRole` could be read as an access check
**Decision:** Fixed - its doc comment and the README say it decides UI only, and the example's
account page uses it for the link while the admin page calls `requireRole` itself.

## Security checklist

- Nothing granted by default; no admin listed and no rows → 404 / `auth.forbidden` (unit + e2e).
- Roles are read from the session on every request, never bound to an action or stored in the cookie.
- Undeclared roles throw (fail closed, visible); role names are a `CHECK` constraint too.
- `adminEmails` trusts the first registrant of a listed email: documented in the options table,
  the Roles section and the limitations; the script is the recommended bootstrap.
- Scripts: dry run by default, one transaction, reports by user id only (unit test asserts the
  email is never printed).
