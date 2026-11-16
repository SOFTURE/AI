---
change_id: auth-workers-password
title: "auth: PBKDF2 password hashes and Web Crypto OIDC on Workers"
status: open
roadmap_item: RP-3
issue: null
branch: null
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Users keep their passwords when an app moves between a VPS and Cloudflare. On Workers the module hashes with PBKDF2-SHA256 from Web Crypto, because scrypt at the current cost needs about 128 MB, the whole isolate limit. Both formats verify on both runtimes and a login rehashes into the runtime's format.

## Context

`modules/auth/src/server/password.ts` writes self-describing `scrypt$N$r$p$salt$key` hashes and already rehashes on a parameter change (`needsRehash`). OIDC uses `KeyObject`, `createPublicKey` and `verify` from `node:crypto`; session tokens and temporary passwords use `randomBytes`, `createHash` and `randomInt`.

## Constraints

- No stored hash is ever rewritten except at a successful login.
- Iteration count follows current OWASP guidance for PBKDF2-SHA256 and is recorded in the hash.
- Constant-time comparison on both formats; tests cover scrypt→pbkdf2 and pbkdf2→scrypt logins.

## Notes

- Item block: [`roadmap.md` → RP-3](../../foundation/roadmap.md).
