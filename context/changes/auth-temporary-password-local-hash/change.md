---
change_id: auth-temporary-password-local-hash
title: "auth 0.1.9: set-temporary-password takes a precomputed hash and a readable alphabet (issue #244)"
status: plan_reviewed
roadmap_item: null
issue: 244
branch: claude/project-thread-e0icx9
created: 2026-10-08
updated: 2026-10-08
---

## Intent

Close every point of [issue #244](https://github.com/SOFTURE/AI/issues/244). The `set-temporary-password` ops script
creates the password on the server and prints it, so the plain password exists on the production host and in its
terminal output. An operator must be able to:

1. compute the password and its hash locally and give the script only the hash (`--password-hash=<scrypt string>`,
   or `--password-hash-file=-` to keep it off argv), using an exported `createTemporaryPassword({ alphabet, length })`
   and the module's `hashPassword` for the local half;
2. optionally use a readable alphabet (no `0/O`, `1/l/I`, no `-`/`_`), both locally and in the script.

Dry run by default and the before/after report stay as they are.

## Context

Issue #244, found while an adopting app audited its own operator flow against the package. Work is tracked in GitHub
Issues: no roadmap item; the PR closes the issue.

## Constraints

- Scope: `modules/auth` only. No other open PR touches it.
- Without the new argument and option the script behaves as in 0.1.8 (random base64url password, at least 20
  characters and at least `password.minLength`, printed once).
- The hash never appears in a message, a refusal or the report (it is secret-derived data).
- English-only code and docs.

## Process notes

- Research: skipped as a separate file. The issue names the file and line; reading `scripts/temporary-password.ts`,
  `server/password.ts`, the ops script helper (`modules/ops/src/scripts/ops-script.ts`, its `secrets` mechanism) and
  the existing test answered every unknown. The findings are in plan.md's "Today" section.
- Framing: skipped. The gap is observed (the plain password on the server) and the adopter's suggested fix maps onto
  mechanisms the packages already have (`secrets`, `hashPassword`); no competing explanation to weigh.
