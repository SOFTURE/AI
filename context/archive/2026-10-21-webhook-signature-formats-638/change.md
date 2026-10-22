---
change_id: webhook-signature-formats-638
title: "security: verifyWebhookSignature in provider formats and a webhook delivery ledger (issue #638)"
status: archived
roadmap_item: null
issue: 638
branch: claude/project-thread-c9h31v
created: 2026-10-21
updated: 2026-10-21
archived_at: 2026-10-21
---

## Intent

Close [issue #638](https://github.com/SOFTURE/AI/issues/638): `verifySignedRequest` checks SOFTURE's own
`t=<seconds>,v1=<hex>` format. Webhooks from third-party products sign the raw body with HMAC-SHA256 (or SHA-1) in
hex or base64, often with a prefix such as `sha256=`, and carry no timestamp; they repeat a delivery id on retries.
Give apps a verifier for those formats (constant time, raw bytes, secret lists for rotation) and a small ledger of
delivery ids so a handler acknowledges a replay with 200 and skips it, with retention pruned through
`@softure-ai/jobs`.

## Context

Labels: `enhancement`, `pkg: security`. #636 (security, PR #642) merged before this starts; its CHANGELOG entry
sits under `## Unreleased`, and this change adds to it. No release in this change: the coordinator releases
security with #636 and #638 together.

## Constraints

- `verifySignedRequest` and `signRequestBody` keep their behaviour.
- The verifier lives in the side-effect-free entry `@softure-ai/security/signed-request` (Web Crypto only), so an
  edge worker can use it too.
- The ledger is one `INSERT … ON CONFLICT DO NOTHING`: two parallel retries cannot both be first.
- Migrations move forward only and say how to roll back.
- No provider SDKs; presets are documentation.

## Notes

- Framing: skipped. The issue names the problem and the API.
