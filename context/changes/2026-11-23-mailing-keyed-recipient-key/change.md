---
change_id: mailing-keyed-recipient-key
title: "mailing, privacy: a keyed, slow email key instead of a plain SHA-256 (issue #1418)"
status: open
roadmap_item: null
issue: 1418
branch: claude/project-thread-8q4hnr
created: 2026-11-23
updated: 2026-11-23
---

## Intent

The key under which mailing stores a recipient (suppressions, the delivery ledger, unsubscribe links) and privacy
stores an email subject (consents) can no longer be reversed from a list of candidate addresses: it is derived with
PBKDF2-HMAC-SHA256 under a server secret, `SOFTURE_EMAIL_KEY_SECRET`, instead of a plain SHA-256. Code scanning alert
#97 (`js/insufficient-password-hash`) closes.

## Context

Issue #1418 (labels `security`, `pkg: mailing`). `getRecipientKey` (mailing) and `getEmailKey` (privacy) are both
base64url SHA-256 of the trimmed, lowercased address, and waitlist relies on the two being equal: an unsubscribe
carries only the recipient key, and waitlist withdraws the privacy consents stored under the same key.

## Scope

- One derivation in both packages: PBKDF2-HMAC-SHA256 of the normalized address, salted with a domain prefix and
  `SOFTURE_EMAIL_KEY_SECRET` (at least 32 characters), 32 bytes, base64url (43 characters, the stored shape).
- mailing: `getRecipientKey`, the SQL surface (the address-taking functions go; the views stay), docs, env list.
- privacy: `getEmailKey`, docs, env list.
- waitlist, the example app and its e2e: the new secret.
- Breaking, without a transition (owner's word 2026-11-23: the package has practically no users, nothing is
  recomputed). Release mailing, privacy and waitlist after the merge.

## Constraints

- No change to any app repository; the CHANGELOG says what an app does.
- Runs on Node and Workers (`node:crypto` `pbkdf2Sync` exists in both).

## Notes

- frame skipped: the owner chose the option (PBKDF2, breaking, no data transition) on 2026-11-23.
