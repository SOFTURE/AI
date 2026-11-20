---
change_id: auth-invitations
verdict: approved
---

# Plan review

- Scope matches change.md and every point of issue #1406 (invite, accept while closed, manage, OIDC by docs).
- Race: two acceptances of one link. The row lock serialises them; the second sees `accepted_at` set. Covered by a
  reuse test.
- Race: the email registered by other means between invite and acceptance. The user insert conflicts and the
  invitation stays pending; `auth.email_taken` is shown. Accepted.
- Enumeration: a dead link never names the email (neutral page, no email in the error). The admin page is admin-only.
- Personal data: invitations hold an email, so they join the privacy export and deletion of the account they created
  or that sent them (inviter set to null on delete).
- Test gap check: expiry, reuse, revoke, wrong email, other email still refused while closed, roles held, inviter and
  time recorded, rate limit. All in phase 1.

Verdict: approved, no changes.
