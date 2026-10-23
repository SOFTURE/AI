# Research: a handler for third-party webhooks (issue #665)

## Current state (master d530152)

- `readSmallBodyBytes(request, { maxBytes })` (`src/read-small-body.ts`): raw bytes or `security.body_too_large` /
  `security.body_unreadable`.
- `verifyWebhookSignature({ secret, header, body, algorithm, encoding, prefix? })` and `signWebhookBody` in
  `src/signed-request.ts` (entry `/signed-request`, re-exported from the root). Fails closed with
  `security.signature_invalid`; throws on an unknown algorithm or encoding.
- `recordDeliveryOnce(ctx, { source, deliveryId })` (`src/server/webhook-deliveries.ts`): `Ok<true>` first,
  `Ok<false>` replay, `Err<"security.delivery_id_invalid">`; throws on a malformed `source`. Meant to run with the
  work's transaction as `ctx.db`.
- `SecurityContext = ModuleContext<Queryable>`; `Queryable` is drizzle's `PgDatabase`, which has `transaction()`
  (a transaction is itself a `Queryable`, nested calls become savepoints). Other modules run
  `ctx.db.transaction(async (tx) => …)` the same way (billing `payments.ts`).
- README §4 "Third-party webhooks" holds the 25-line route and a table of presets: GitHub (sha256 and legacy sha1),
  Shopify, Lemon Squeezy (no delivery id header: the id is in the payload).
- Error logging precedent in route helpers: `console.error("@softure-ai/<pkg>: <operation> failed: <message>")`
  (agent-ready `next/routes.ts`, analytics `server/channel.ts`).
- Codes live in `src/contract.ts` (`SecurityErrorCode`) with English messages in `src/messages/en.ts`.
- zod 4 is already a dependency; packages validate external data with zod schemas.

## Findings

- The README's `JSON.parse` throws on a body that is not JSON or not UTF-8; the route then answers 500 and the
  sender keeps retrying a delivery that can never succeed. It should be 400.
- Next.js route handlers are `(request: Request) => Promise<Response>`, so a function that takes a `Request` and
  returns a `Response` is already the route body on Next.js, Hono, Workers and plain Node with web streams. A
  separate route wrapper would add one line of value.
- Lemon Squeezy has no delivery id header, so the id must be taken from the validated event.
