---
change_id: auth-exact-hash-check
title: "auth: isPasswordHash accepts only a hash this module could have written (issue #287)"
status: archived
roadmap_item: null
issue: 287
branch: claude/project-thread-uz20c2
created: 2026-10-08
updated: 2026-10-08
archived_at: 2026-10-08
---

## Intent

`isPasswordHash` checks only the shape `scrypt$N$r$p$salt$key` with non-empty parts. A hash cut by one character
in transport, or with a stray character, passes it; `set-temporary-password --password-hash` uses it as its only
check, stores the damaged hash and every login with the handed-over password then fails, locking the account
([#287](https://github.com/SOFTURE/AI/issues/287)).

After this change `isPasswordHash` is exact: salt and key are base64url and decode to exactly the 16-byte salt and
64-byte key `hashPassword` writes (22 and 86 characters), and the cost is a power of two above 1 (the only values
scrypt accepts). The script refuses anything else as a usage error, as today, before touching the database.

A reviewer checks `modules/auth/tests/password.test.ts`, `modules/auth/tests/temporary-password*.test.ts`, the
README line on `isPasswordHash`, the CHANGELOG and the version bump (auth 0.1.10).

## Context

- `readHashParts` is shared by `isPasswordHash` and `parseHash` (used by `matchPassword` and `needsRehash`).
- `isPasswordHash` was added in 0.1.9 for the script's argument and for the operator's local half; nothing else in
  the module calls it.
- Every stored hash in an adopting app's `auth.users` was written by `hashPassword` (registration, reset, change,
  rehash at login, the script); there is no import of foreign hashes.

No roadmap: issues are the tracker.

## Constraints

- English-only code, comments and commits; neutral wording on GitHub and in the repo.
- Only `@softure-ai/auth` changes; bumps 0.1.9 → 0.1.10 and is released after the merge.
- Reading stored hashes (`matchPassword`, `needsRehash`) must not change: a stricter reader could turn a stored
  hash into a thrown error at login.

## Process notes

- Research: skipped as a separate artefact. The issue names the function and file; the reading needed (one file,
  its one caller in the script, the tests) fits in `plan.md` § Findings.
- Framing: done inline in `plan.md` § Key decisions (D1 weighs the issue's two options); the problem itself is not
  in doubt.
