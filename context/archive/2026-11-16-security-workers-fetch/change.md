---
change_id: security-workers-fetch
title: "security: guarded outbound requests and client addresses on Workers"
status: archived
roadmap_item: RP-5
issue: null
branch: claude/project-thread-dufdk1
created: 2026-11-16
updated: 2026-11-16
---

## Intent

Outbound requests to user-supplied URLs stay guarded on Workers: private and reserved targets are refused, redirects are re-checked and bodies are limited, on `fetch` instead of `node:http` and `node:dns`.

## Context

`modules/security/src/server/guarded-request.ts` pins DNS with `node:dns` `lookup` and requests through `node:http`/`node:https`; `public-address.ts` and `client-ip.ts` use `node:net` `BlockList`; `guarded-get.ts` decompresses with `node:zlib`.

## Constraints

- Same refusal results (error kinds) on both runtimes.
- The Workers residual risk (no DNS pinning) is documented in the package README.
- Node path keeps DNS pinning.

## Notes

- Item block: [`roadmap.md` → RP-5](../../foundation/roadmap.md).
