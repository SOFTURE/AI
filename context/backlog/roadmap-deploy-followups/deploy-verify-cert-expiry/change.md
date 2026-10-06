---
change_id: deploy-verify-cert-expiry
title: "softure-deploy verify fails when the TLS certificate expires within a set number of days"
status: backlog
roadmap_item: DF-6
branch: null
created: 2026-10-05
updated: 2026-10-05
archived_at: null
---

## Intent

An app learns from its deploy that its certificate is about to expire, not from users: `verify.tlsMinDays` in
`deploy.json` makes `softure-deploy verify` read the peer certificate of an `https://` URL and fail when fewer days
are left.

## Context

From [`roadmap.md`](../../../foundation/roadmap.md) (deploy-followups), item **DF-6** (main roadmap since 2026-10-06):

> - **Outcome:** an optional `verify.tlsMinDays`; `verify` reads the certificate with `node:tls` once per run and adds
>   a `tls` row to the table (days left, issuer); fewer days than the minimum is a failure. Tested against a local
>   TLS server with a generated certificate.
> - **Source:** DP-4 (`deploy-verify-production`), research question 1: `fetch` refuses an invalid or expired
>   certificate, but nothing warns before expiry.

## Constraints

- Owns `tools/deploy/src/verify/`, `tools/deploy/schema/` and their tests.
- No request to a real production URL in tests.

## Notes

- Behind Cloudflare the certificate seen is the edge one, which Cloudflare renews; the check matters for an origin
  served directly. Say so in the README.
