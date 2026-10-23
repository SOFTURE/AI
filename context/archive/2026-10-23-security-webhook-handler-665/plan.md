---
change_id: security-webhook-handler-665
status: archived
---

# Plan: one handler for third-party webhooks (issue #665)

Input: change.md, research.md. Complexity: small (one package: one server function, presets, a test helper, docs).

## Phase 1: presets and the signed request helper (TDD)

Files: `modules/security/src/signed-request.ts`, `src/index.ts`, `tests/webhook-signature.test.ts`.

1. Tests first: each preset verifies a body signed with it; `signWebhookRequest` builds a POST whose signature
   header verifies, carries the delivery id header when given, and keeps extra headers.
2. `WebhookSender = WebhookSignatureFormat & { header; deliveryIdHeader? }`; `WEBHOOK_SENDERS` with `github`,
   `githubSha1`, `shopify`, `lemonSqueezy` (the README table, header names lowercase).
3. `signWebhookRequest({ url, sender, secret, body, deliveryId?, headers? }): Promise<Request>`.

## Phase 2: handleWebhook (TDD, PGlite)

Files: `src/server/webhook.ts` (new), `src/server/index.ts`, `src/contract.ts`, `src/messages/en.ts`,
`tests/webhook.test.ts` (new).

1. Tests first: 200 and `handle` called once with the parsed event and a transaction context; a replay answers 200
   without calling `handle`; 413 over `maxBytes`; 401 on a wrong signature, with nothing parsed and nothing recorded;
   400 `security.webhook_payload_invalid` on a body that is not JSON and on one the schema refuses, nothing recorded;
   400 `security.delivery_id_invalid` on a missing id header; the id taken from the event when the sender has no
   header; `handle` throwing answers 500 `security.webhook_failed`, leaves no record (the retry is processed) and logs
   the operation without the body; a sender with neither a header nor `deliveryId` throws (configuration bug).
2. `handleWebhook(ctx, request, { source, maxBytes, sender, secret, schema, deliveryId?, handle })`:
   `readSmallBodyBytes` → `verifyWebhookSignature` → UTF-8 decode + `JSON.parse` (guarded) → `schema.safeParse` →
   delivery id → `ctx.db.transaction(recordDeliveryOnce, handle)`. Answers `Response.json({ error: code })` or an
   empty 200.
3. New codes `security.webhook_payload_invalid`, `security.webhook_failed` with English messages.

## Phase 3: docs

Files: `modules/security/README.md`, `CHANGELOG.md` (Unreleased).

1. README "Third-party webhooks": the route becomes a `handleWebhook` call; presets table names the constants; the
   lower-level functions stay documented for senders the helper does not fit.
2. CHANGELOG entry and the two new codes for apps with their own translation.

## Decisions (auto)

- No separate route wrapper (`createWebhookRoute`) and no `/next` entry: `handleWebhook` takes a `Request` and
  returns a `Response`, so it is the route body itself (`export const POST = (request) => handleWebhook(ctx(),
  request, options)`). One function, nothing extra to maintain, in line with the owner's "no overengineering".
- The secret is passed as a value (`process.env.X` read by the app), not an env name: the package never reads env.
- A sender is one object (signature header, format, delivery id header), so a preset is spread as is; `deliveryId`
  is an optional function on the event for senders without an id header.
- `handle` failing is caught: rolled back, logged with `console.error` (package prefix, error message only, never
  the body) and answered 500 with a code. Letting it propagate would leave the answer to the host.
- (During implementation) configuration checks (module configured, `source` rule, delivery id source) run before the
  request is read, so the catch around the transaction only ever sees the work's or the database's failure;
  `assertSource` is exported inside the package for that.
- (During implementation) the JSON parse returns a result value instead of `undefined`, so a schema that accepts
  `undefined` cannot let a non-JSON body through.
- (During implementation) `signWebhookRequest` sets `content-type: application/json` unless the caller's headers set
  one.
- A body that is not UTF-8 or not JSON, and one the schema refuses, share `security.webhook_payload_invalid`: the
  sender cannot fix either by retrying.

## Progress

- [x] Phase 1: presets and the signed request helper (6db41d5)
- [x] Phase 2: handleWebhook (6db41d5)
- [x] Phase 3: docs (1f2c06b)
