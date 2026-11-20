# Implementation review: auth-oidc-link-unverified

- Drift from plan: none.
- Correctness: identity check and revocation share the sign-in transaction; two concurrent first sign-ins end with
  one identity, and the loser is refused before it revokes.
- Tests: regression tests for OIDC and GitHub, a negative test for an already verified account.
- Docs: README Accounts and CHANGELOG (Unreleased) describe the behaviour and the owner's way back (a reset link).
- Verdict: approve.
