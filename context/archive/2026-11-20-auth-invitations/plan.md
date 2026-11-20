# Plan: auth-invitations

## Approach

Copy the password reset design (hashed single-use token, sender hook, mailing adapter) for invitations, accept them
through the register route, and add one admin page in the Next adapter.

## Decisions (auto)

- Acceptance reuses `RegisterPage` with `?invitation=<token>` instead of a new route: no new mount, the form and its
  consent and registration fields stay the same.
- One pending invitation per email (partial unique index). Inviting an email again refreshes the pending one (new
  token, roles, inviter, expiry); an email that already has an account is refused with `auth.email_taken`.
- The form posts the email; a different email than the invited one is refused with `auth.invitation_email_mismatch`.
  The token holder already knows the email, so this reveals nothing new. Any dead link answers
  `auth.invitation_invalid` and the neutral page.
- Roles are validated against the declared roles at invite time; at acceptance, roles no longer declared are skipped.
- Rate limits: a new `invitation` bucket per inviting admin (invite and resend); acceptance counts in `register`.
- Audit: one `console.info` line per event with invitation id and user ids, never the email or the link.
- OpenID Connect: documented, not wired (the allowlist stays the only gate for provider sign-in).
- Mail delivery runs in the admin's request (the admin sees a failure); not through a job.
- Default link lifetime 72 hours (`invitations.ttlHours`, 1 to 720).
- No version bump in this change: the coordinator batches releases; the CHANGELOG gets an `Unreleased` entry.

## Phases

1. Migration 0007, schema, options, manifest, buckets, server functions, privacy, health; server tests
   (expiry, reuse, revoke, wrong email, closed registration, roles, inviter, rate limit).
2. Mail renderer and `mailingInvitationSender`, messages, Next actions, register page with invitation, admin page and
   client panel; page and action tests.
3. README, CHANGELOG, module.json; full gates.

## Progress

- [x] Phase 1 (dd91976): `npx vitest run modules/auth/tests/invitations.test.ts` 21/21 (expiry, reuse, revoke, wrong
      email, other email while closed, roles, inviter and time, rate limits, constraints, audit lines, failing sender);
      privacy and module tests updated.
- [x] Phase 2 (a4cf0e6): `npx vitest run modules/auth/tests/invitations-next.test.tsx modules/auth/tests/invitation-mail.test.ts`
      11/11; the whole auth suite 540/540 (architecture guards included).
- [x] Phase 3 (8de047e): README section 3 "Invitations", sections 4, 5 and 11, CHANGELOG `Unreleased`. `npm run typecheck`
      and `npm run lint` green.

## Deviations

- A sender that throws is caught by the server functions and answered as `auth.invitation_not_sent` (the plan let it
  propagate): the admin action can then name the cause, and the invitation stays pending for Resend.
- Actions redirect back to the page with `?notice=` instead of returning `ok`, so the list is read again without
  `next/cache`.
