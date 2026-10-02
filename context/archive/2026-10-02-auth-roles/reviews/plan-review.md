# Plan review: auth-roles

Reviewed: plan.md @ 2026-10-02 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.

## Findings

### W1 [WARNING] `adminEmails` turns registration into an admin grab
**Where:** Approach, bootstrap
**Problem:** auth does not verify emails, so a stranger who registers a listed email before its
owner becomes admin.
**Decision:** Fix now (applied) - the README section on roles says so in the option's row and in
the bootstrap steps (create the account first or keep registration closed; prefer `grant-role`);
the example app's e2e registers the listed account itself.

### W2 [WARNING] A refused admin action must not reveal more than the page does
**Where:** Phase 2, `authorizeRole`
**Problem:** answering `auth.unauthenticated` to anonymous callers and `auth.forbidden` to others
tells a prober whether a session is live, which is fine, but the action must refuse before reading
any input or doing work.
**Decision:** Fix now (applied) - `authorizeRole` returns one code, `auth.forbidden`, for both, and
the example action calls it first, before parsing the form; the e2e checks that nothing was written.

### S1 [SUGGESTION] Revoking a config-granted admin with the script would silently do nothing
**Decision:** Fix now (applied) - `revoke-role` refuses with a reason naming `adminEmails` when the
role comes only from the configuration.
