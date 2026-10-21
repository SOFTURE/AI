---
change_id: webhook-signature-formats-638
---

# Research: provider webhook signatures and a delivery ledger

## What the package has

- `src/signed-request.ts`: `signRequestBody` and `verifySignedRequest` (Web Crypto, HMAC-SHA256 over
  `"<t>.<body>"`, hex, `SigningSecret = string | readonly string[]`, constant-time byte comparison, minimum secret
  length 32). Exported from `.` and from `./signed-request` (no other imports).
- Database work in `src/server/` takes `SecurityContext = ModuleContext<Queryable>`; `ctx.db` may be a
  transaction. `consumeRateLimit` is the model for a one-statement upsert.
- `src/jobs/index.ts`: `securityJobHandlers` / `securityJobSchedules` (`security.prune-rate-limits`, hourly);
  `@softure-ai/jobs` is an optional peer. Other modules schedule daily pruning with `{ every: "1d" }`.
- One migration, `0001_create_rate_limits.sql`; the manifest lists `tables: ["rate_limits"]`, and `module.json`
  must equal the manifest (`tests/module.test.ts`).
- Options (`src/options.ts`) are a strict zod object with defaults (`cleanupProbability`).

## Provider formats (public documentation)

| Provider | Signature header | Algorithm, encoding | Delivery id header |
| --- | --- | --- | --- |
| GitHub | `X-Hub-Signature-256` | HMAC-SHA256, hex, prefix `sha256=` (legacy `X-Hub-Signature`: SHA-1, `sha1=`) | `X-GitHub-Delivery` |
| Shopify | `X-Shopify-Hmac-Sha256` | HMAC-SHA256, base64 | `X-Shopify-Webhook-Id` |
| Lemon Squeezy | `X-Signature` | HMAC-SHA256, hex, no prefix | none (the event's own id) |

All of them sign the raw request body with the secret as UTF-8 key bytes. Retries repeat the delivery id
(GitHub redeliveries keep `X-GitHub-Delivery`; Shopify keeps `X-Shopify-Webhook-Id`), and retries span hours to days
(Shopify retries for up to 48 hours), so a retention of 30 days covers them with a wide margin.

## Pitfalls the API must close

- comparing strings instead of bytes in constant time;
- verifying re-serialised JSON instead of the raw bytes;
- accepting a signature that decodes to the wrong length, or hex/base64 in a lax form;
- recording a delivery before the work and losing it when the work fails: the retry is then skipped. The record
  must live in the work's transaction, or be forgotten when the work fails.

## Decisions for the plan

- Secrets are provider-issued (GitHub lets the user type one), so the verifier does not enforce
  `MIN_SIGNING_SECRET_LENGTH`; an empty or missing secret still fails closed.
- Hex is accepted in either case (some senders upper-case it); base64 is standard base64, padding optional.
