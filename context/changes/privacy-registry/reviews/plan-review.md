# Plan review: privacy-registry

Reviewed: plan.md @ 2026-10-03 (author's review, `--auto`). Verdict: approve after fixes.
Findings: 0 critical, 2 warning, 1 suggestion.

## Findings

### W1 [WARNING] A session alone must not delete an account
**Where:** Approach, confirmation
**Problem:** with only a checkbox, anyone holding a session cookie (a shared computer, a stolen
cookie) deletes the account for good, and an unlimited password check becomes a guessing oracle.
**Decision:** Fix now (applied) - the current password and the checkbox are both required, and
`privacy-delete` counts each attempt per user before the password is checked.

### W2 [WARNING] An app contributor with a module's id hides which part failed
**Where:** Phase 1, registry
**Problem:** export keys and log lines are contributor ids; an app contributor named `auth` would
overwrite auth's part of the export.
**Decision:** Fix now (applied) - `getPrivacyContributors` throws for an app id equal to an enabled
module's id, and the options refuse duplicate app ids.

### S1 [SUGGESTION] Deleting through the cascade from `auth.users` only
**Decision:** Rejected - it misses references without a FK (`features.switches.updated_by`) and
tables of modules that do not reference auth; every module states its own deletion instead, and the
schema scan test catches a module that forgets.
