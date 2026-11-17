---
change_id: auth-open-sign-up
verdict: approved
---

# Plan review

- Scope matches change.md: option, gate, code, copy, fake, docs, release.
- Risk: account linking by email through an open provider. Unchanged rules apply (verified email only; one identity per
  provider per account), the same as an allowlisted domain today. Accepted.
- Risk: the switch read before the transaction can race a switch flip by milliseconds. Harmless.
- Test gap check: unverified email, closed switch with an existing account, passwordless app, allowlist provider
  unchanged; all in phase 1.

Verdict: approved, no changes.
