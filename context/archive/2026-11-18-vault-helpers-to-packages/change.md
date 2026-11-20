---
change_id: vault-helpers-to-packages
title: "files, security, analytics: a fake S3 bucket, the client-IP resolver from the environment, the funnel per day"
status: archived
archived_at: 2026-11-18
roadmap_item: null
issue: null
branch: claude/project-thread-l68u38
created: 2026-11-18
updated: 2026-11-18
---

## Intent

Move three helpers an adopting app wrote for itself into the packages they extend, so the next app does not write
them again: a SigV4-checking fake S3 bucket for tests, the choice of client-IP resolver from the environment (hosted
behind Cloudflare, self-hosted behind its own proxy), and the funnel report one day at a time.

## Scope

- files `./testing`: `createFakeS3` (ListObjectsV2, GetObject with `If-Match` and range, writable Put/Head/Delete,
  injected failures, call counts).
- security: `readClientIpSource`, `createClientIpResolver`, `clientIpFromEnv` (`CLIENT_IP_SOURCE`,
  `TRUSTED_PROXY_HOPS`).
- analytics `./server`: `getFunnelDays` (one grouped query, every day present) and `formatFunnelDays`.
- Patch releases (additive): files 0.5.3, security 0.2.11, analytics 0.3.6.

## Notes

Research skipped: the code already runs in the adopting app with its tests; it moves with them, the app's names kept
generic. Frame skipped: a move, not a new behaviour.
