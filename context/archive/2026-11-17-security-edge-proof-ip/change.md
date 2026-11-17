---
change_id: security-edge-proof-ip
title: "security/deploy: an edge-proof client-IP resolver for apps on a shared edge network (issue #1329)"
status: archived
roadmap_item: null
issue: 1329
branch: claude/project-thread-bxmbav
created: 2026-11-17
updated: 2026-11-17
archived_at: 2026-11-17
---

## Intent

An app set up with `softure-deploy init --edge=<network>` shares a Traefik network with other projects' containers.
Any of them can call `app:3000` directly and send its own `CF-Connecting-IP` (or `X-Forwarded-For`) per request,
which bypasses the rate-limit buckets of `security()`. The app must trust a client-IP header only on requests that
came through its own router: the router adds a secret header, and a resolver wrapper trusts the inner resolver only
when that header carries the secret.

## Context

Issue #1329 (labels: security, pkg: security, pkg: deploy). Resolvers live in `modules/security/src/client-ip.ts`;
the edge compose labels in `tools/deploy/templates/docker/prod/docker-compose.yml.tmpl`; the shared-host guard in
`tools/deploy/src/testing/shared-host-compose.ts`.

## Constraints

- No change to an adopting app's repository; the migration is described in both CHANGELOGs.
- A resolver without the proof header configured behaves exactly as before.
- English only in the repository.

## Notes

- Frame skipped: the issue states the threat, the adopting app's working fix and the proposal.

## Outcome (2026-11-17)

`edgeProofIp({ resolver, secret, header? })` in `@softure-ai/security`; `init --edge` writes the proof middleware and
the required `EDGE_PROOF_SECRET`, with `next` lines for the secret and the resolver; `checkSharedHostCompose` reports
`edge-proof-missing`. Rides the next release of both packages (security 0.2.10, deploy 0.7.2).
