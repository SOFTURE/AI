---
change_id: security-signed-requests
title: "Apps verify signed webhook requests and read capped raw bodies with security helpers"
status: archived
roadmap_item: null
issue: 469
branch: claude/project-thread-cxv9g2
created: 2026-10-14
updated: 2026-10-14
archived_at: 2026-10-14
---

## Intent

Close [issue #469](https://github.com/SOFTURE/AI/issues/469). An app that receives webhook-style requests (inbound
mail from an edge worker, payment providers, CI callbacks) authenticates them with `@softure-ai/security` instead of
its own code: a shared-secret HMAC-SHA256 signature over `"<unix seconds>.<body>"` with a freshness window, a
constant-time comparison and several `v1=` values for secret rotation. The sending side (a Cloudflare Worker) signs
with the same helper on Web Crypto. The app can also read a size-capped body as raw bytes, so a MIME message in a
non-UTF-8 charset no longer needs a base64 envelope.

## Context

Issue #469 (labels `enhancement`, `pkg: security`, `adoption`), proposal quoted:

> - `signRequestBody({ secret, body, now })` → header value `t=<seconds>,v1=<hex>`
> - `verifySignedRequest({ secret, header, body, now, toleranceSeconds = 300 })` → `Ok<void>` or
>   `Err<"security.signature_invalid">`; refuses a missing or short secret (fail closed), a malformed header, a stale
>   timestamp and a wrong MAC; supports several `v1=` values for secret rotation.
> - `readSmallBodyBytes(request, { maxBytes })` → `Ok<Uint8Array>` with the same streaming cap as `readSmallBody`.
>
> Both are pure functions; the signer must also run on Web Crypto (Workers) so the sending side can share the contract.

Known state: `modules/security/src/read-small-body.ts` decodes UTF-8 with `fatal: true`;
`modules/billing/src/stripe-webhook.ts` already verifies Stripe's `t=,v1=` header with `node:crypto`.

## Constraints

- Owns `modules/security/` only. Billing's Stripe verifier stays as it is (Stripe's contract, Node-only is fine there).
- No change in any adopting app's repository; the migration is described in the CHANGELOG, README and the issue.
- Additive, non-breaking: `readSmallBody` keeps its behaviour.
- No version bump here: releases are batched by the coordinator; the CHANGELOG gets an `Unreleased` section.

## Notes

- Placement: unlinked one-off from the issue queue (`autonomy.source: issues`), `roadmap_item: null`.
- Framing: skipped. The issue names a concrete gap with a concrete contract; nothing about the problem is in doubt.
- Archived 2026-10-14: `@softure-ai/security` signs and verifies webhook requests on Web Crypto and reads capped bodies as raw bytes; ships in the next security release.
