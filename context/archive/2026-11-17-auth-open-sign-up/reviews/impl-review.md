---
change_id: auth-open-sign-up
verdict: approved
---

# Implementation review

Reviewed the diff on `claude/project-thread-dyaxco` against plan.md.

- Drift: none. `openSignUp` on the shared allowlist shape, `isAllowedEmail` short-circuits on it, `resolveOidcAccount`
  checks `isRegistrationSwitchOn` before its transaction and only when it would create an account.
- Correctness: unverified emails are still filtered before `isAllowedEmail` (`getAllowedEmail`, `pickGithubEmail`);
  allowlist providers keep creating accounts with registration closed (test).
- Tests: options without an allowlist, creation with `onRegistered`, unverified refusal, closed switch with an existing
  account, passwordless app; the closed-switch test seen red without the check. Full auth suite 507/507 green after the
  two option-shape expectations in `module.test.ts` were updated for the new default.
- Gates: typecheck, ESLint on the module, language gate green. `tests/repo/deploy-workflows.test.ts` fails locally on a
  missing `ssh-keygen` in the container, the same on master; CI runs it.
- Security: open sign-up widens who can create an account by design; the registration switch stays the gate.

Verdict: approved.
