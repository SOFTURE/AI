---
change_id: deploy-verify-web-bot-auth
title: "deploy verify: a route signs its request with Web Bot Auth (issue #341)"
status: archived
roadmap_item: null
issue: 341
branch: claude/project-thread-bi5ajs
created: 2026-10-09
updated: 2026-10-09
archived_at: 2026-10-09
---

## Intent

`softure-deploy verify` checks the response to a request signed with Web Bot Auth, so an adopting app drops the shell
script that signs a request with its Ed25519 key and checks what comes back.

## Context

Issue [#341](https://github.com/SOFTURE/AI/issues/341), split out of #309 (point 6). The signer exists in
`@softure-ai/agent-ready` (`getRequestSignatureHeaders` in `src/server/web-bot-auth.ts`, RFC 9421, Ed25519 on
`node:crypto`). The verify engine is `tools/deploy/src/verify/`; #309 (PR #351, deploy 0.1.8) changes the same files,
so this branch starts from that PR's head.

## Constraints

- The key never enters `deploy.json`, the report or a log line: `deploy.json` names the environment variable.
- A missing or malformed variable fails the route with the variable's name; no request goes out unsigned.
- A `deploy.json` without the new key checks and prints exactly as before.
- English only. Shares unreleased 0.1.8 with #308, #309 and #310.

## Notes

- Research: skipped; the signer and the verify engine were read in full for this change, and the issue names the
  shape of the key.
- Framing: skipped; the problem is concrete (a shell check an app keeps).
- Archived 2026-10-09: `webBotAuth` is a verify route key in 0.1.8; passing the key into `deploy-app.yml`'s verify
  job is a follow-up issue.
