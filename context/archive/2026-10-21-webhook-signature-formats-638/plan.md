---
change_id: webhook-signature-formats-638
status: archived
---

# Plan: provider webhook signatures and a delivery ledger (issue #638)

Input: change.md, research.md. Complexity: medium (one package: a verifier, a table, server functions, a job, docs).

## Phase 1: verifyWebhookSignature (TDD)

Files: `modules/security/src/signed-request.ts`, `modules/security/src/index.ts`,
`modules/security/tests/webhook-signature.test.ts`.

1. Tests first, with vectors computed by `node:crypto` `createHmac` (an independent implementation): GitHub
   (`sha256=` hex), legacy SHA-1 hex, Shopify (base64), hex without prefix; upper-case hex; base64 without padding;
   a rotated secret list; a string body equals its UTF-8 bytes; wrong MAC, wrong secret, a changed byte, missing
   header, empty or missing secret, an empty secret in a list, wrong prefix, the prefix missing, wrong length,
   non-hex / non-base64 characters, a SHA-1 signature checked as SHA-256; `signWebhookBody` round trip; a range
   error on an unknown algorithm or encoding.
2. `verifyWebhookSignature({ secret, header, body, algorithm, encoding, prefix? })` →
   `Ok<undefined> | Err<"security.signature_invalid">`; `signWebhookBody({ secret, body, algorithm, encoding,
   prefix? })` → the header value (for tests and for senders). Shared HMAC and constant-time helpers with the
   existing code.

## Phase 2: the delivery ledger (TDD)

Files: `modules/security/migrations/0002_create_webhook_deliveries.sql`, `modules/security/src/schema.ts`,
`modules/security/src/options.ts`, `modules/security/src/contract.ts`, `modules/security/src/messages/en.ts`,
`modules/security/src/server/webhook-deliveries.ts`, `modules/security/src/server/index.ts`,
`modules/security/src/index.ts`, `modules/security/module.json`, `modules/security/src/jobs/index.ts`,
`modules/security/tests/webhook-deliveries.test.ts`, `modules/security/tests/jobs.test.ts`,
`modules/security/tests/module.test.ts`.

1. Tests first (PGlite): first delivery `ok(true)`, the replay `ok(false)`, the same id under another source is new,
   parallel records of one id give exactly one `true`; a record inside a rolled-back transaction leaves no row;
   `forgetDelivery` lets the retry through; an empty, over-long or control-character id is
   `security.delivery_id_invalid`; a malformed source throws; `pruneWebhookDeliveries` deletes rows older than
   `webhookDeliveries.retentionDays` (default 30) and keeps newer ones; the jobs schedule prunes them daily; the table's
   constraints refuse bad rows.
2. Migration `security.webhook_deliveries(source, delivery_id, received_at)`, primary key `(source, delivery_id)`,
   checks on both, an index on `received_at`; rollback comment.
3. `recordDeliveryOnce(ctx, { source, deliveryId })`, `forgetDelivery(ctx, { source, deliveryId })`,
   `pruneWebhookDeliveries(ctx)`; option `webhookDeliveries: { retentionDays }`; new code
   `security.delivery_id_invalid` with English copy; job `security.prune-webhook-deliveries` (`1d`); manifest and
   `module.json` list the new table.

## Phase 3: docs

`modules/security/README.md` (section "Third-party webhooks" with GitHub, Shopify and Lemon Squeezy presets, the
ledger, migrations table, copy, GDPR, jobs, limitations), `modules/security/CHANGELOG.md` `## Unreleased`.

## Decisions (auto)

- The verifier sits next to `verifySignedRequest` in `signed-request.ts` and reuses its `SigningSecret` type, so it
  is available from the edge-safe entry `@softure-ai/security/signed-request` and from the root.
- No minimum secret length for provider secrets (they are not ours to choose); empty secrets fail closed.
- `prefix` is matched exactly (case-sensitive) after trimming the header; without `prefix` a header that has one fails.
- An invalid delivery id comes from a request header, so it is a value (`security.delivery_id_invalid`), not an
  exception; an invalid `source` is the app's constant, so it throws.
- `forgetDelivery` is added beside `recordDeliveryOnce`: an app that cannot record inside the work's transaction
  forgets the id when the work fails, so the provider's retry is processed.
- Retention is a module option (default 30 days, 1 to 365), pruned daily by `@softure-ai/jobs` or the app's cron.
- `signWebhookBody` is added: apps need it to test their handlers without a provider, and it keeps the two sides
  symmetric like `signRequestBody`.

## Progress

- [x] Phase 1: verifyWebhookSignature
- [x] Phase 2: the delivery ledger
- [x] Phase 3: docs

Tests were written first in phases 1 and 2 and failed on the missing exports before the code existed. Follow-ups
outside the package: `examples/next-app/e2e/migrations.spec.ts` lists the new migration, `modules/jobs/README.md`
names the new schedule. Gates: typecheck, lint (language gate included), build, `modules/security` tests (342 passed).
