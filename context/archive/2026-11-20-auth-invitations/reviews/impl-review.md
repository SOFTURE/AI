---
change_id: auth-invitations
verdict: approved
---

# Implementation review

Reviewed the diff against `plan.md` and issue #1406.

- **Acceptance 1** (an invited email registers exactly once while closed; any other email cannot): `registerInvitedUser`
  locks the live row, inserts the user, marks it accepted in one transaction; tests "lets the invited email register
  exactly once…" and "keeps the plain register page closed…".
- **Acceptance 2** (a dead link creates no account and reveals nothing): one error code and one neutral page for
  unknown, malformed, expired, revoked, replaced and used links; the page test asserts the email is absent.
- **Acceptance 3** (roles held, inviter and time recorded): `invited_by`, `created_at`, `accepted_at`,
  `accepted_user_id`; roles granted in the transaction; tests on the server and through the action.
- **Acceptance 4** (tests for expiry, reuse, revoke, wrong email): present on the server and the adapter.
- **Security.** Actions check `admin` before reading input; the page is not found for others. Tokens are 32 random
  bytes, sha256 at rest. The audit lines and the sender error log carry no email or link (tested). Roles are limited to
  declared ones at invite and at acceptance. A wrong email answers a distinct code, but only to a holder of a live link,
  who already knows the invited address.
- **Data.** Migration forward only with a rollback note; constraints for email shape, role names, one pending row per
  email, accepted xor revoked. Privacy export and deletion cover the table.
- **Copy and markup.** English copy in `messages/en.ts`, new keys optional for older dictionaries; the architecture
  guards (no inline copy, no raw colours, only ui classes) pass.
- **Compatibility.** Off without `invitations.send`; the new bucket is required only then. New route and mount added to
  the manifest and `module.json`.

Findings: none blocking. Follow-up not needed.

Verdict: approved.
