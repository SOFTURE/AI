---
change_id: auth-workers-password
title: "auth: scrypt passwords on Workers with a runtime-aware default cost"
status: archived
roadmap_item: RP-3
issue: null
branch: claude/project-thread-dufdk1
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Users keep their passwords when an app moves between a VPS and Cloudflare. workerd runs `node:crypto` scrypt (measured
in RP-5), so the `scrypt$N$r$p$salt$key` format stays on both runtimes. Only the default cost changes with the runtime,
so one hash fits a Workers isolate (128 MB), and a login rehashes into the cost of the runtime it runs on. The auth
entries are declared Workers-safe.

## Context

`modules/auth/src/server/password.ts` writes self-describing hashes and already rehashes on a parameter change
(`needsRehash`). OIDC uses `createPublicKey` and `verify`; session tokens and temporary passwords use `randomBytes`,
`createHash` and `randomInt`. All of these run in workerd.

## Constraints

- No stored hash is ever rewritten except at a successful login.
- An explicit `password.scrypt` from the app wins over the runtime default.
- Constant-time comparison stays; tests cover a login with a Node-cost hash on Workers and the reverse.

## Notes

- Item block: [`roadmap.md` → RP-3](../../foundation/roadmap.md).
- Earlier title "PBKDF2 password hashes and Web Crypto OIDC on Workers": the RP-5 measurement showed neither is needed.
