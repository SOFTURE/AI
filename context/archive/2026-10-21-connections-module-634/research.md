---
change_id: connections-module-634
status: archived
---

# Research: connected accounts module (issue #634)

## What exists

- `@softure-ai/mcp-access` is an OAuth 2.1 **server** (PKCE S256 helpers in `src/server/pkce.ts`, hashed tokens).
  Nothing in the repository acts as an OAuth client.
- `@softure-ai/core`: `defineModule`, `Result`, `safeError`, `errorLogLabel`, `requestJson` (GET only; #635 adds
  writes with a JSON body). `requestJson`'s rules (timeout, `redirect: "manual"`, failures as codes, never reading an
  error message that can quote the URL) are the model for the token client here.
- `@softure-ai/feature-switches` is the closest shape: a small module with one table, an admin-only page guarded by
  `requireRole` / `authorizeRole` from `@softure-ai/auth/next`, a server action, a client panel in `ui/`, a privacy
  contributor that clears the actor id, a health check, and tests on PGlite (`createTestDatabase`).
- `@softure-ai/security` signs webhook bodies with HMAC; not needed here: the state is a one-time server-side record.
- Options that are functions use `z.custom<…>((value) => typeof value === "function")` (mailing `onUnsubscribed`,
  auth `onRegistered`). Secrets come from environment variables read at use time (billing Stripe, mailing Resend), so
  `next build` works without them.
- Bins load the app config through `@softure-ai/core/cli` (`softure-mcp prune` in mcp-access is the template).
- The repository tests (`tests/repo/packages.test.ts`) check the package shape: exports order, CHANGELOG, twelve
  README sections, module.json, dependsOn vs package dependencies, `@softure-ai/ui` as a peer.

## Provider behaviour that shapes the design

- Token endpoints take `application/x-www-form-urlencoded` (RFC 6749 §4.1.3, §6) and answer JSON when asked with
  `Accept: application/json` (GitHub answers form-encoded otherwise, and answers some errors with `200` and an
  `error` field).
- Client authentication: `client_secret_basic` or `client_secret_post`; providers differ, so it is a per-provider
  setting. A public client (PKCE, no secret) sends `client_id` in the body.
- `invalid_grant` on refresh means the grant is gone (revoked consent, Google apps in testing mode whose refresh
  tokens die after 7 days, a rotated token reused). Only a new authorization fixes it.
- Some providers rotate refresh tokens on every use; the old one is spent. A refresh response without
  `refresh_token` keeps the old one otherwise. Some send `refresh_token_expires_in`.
- `expires_in` can be missing (GitHub OAuth apps, Todoist: tokens that do not expire) or a string.
- `scope` in the token response is the granted set; when missing, the requested set was granted (RFC 6749 §5.1).
- Revocation (RFC 7009) is optional and best effort.

## Storage and encryption

- AES-256-GCM from `node:crypto`, 12-byte random IV, 16-byte tag, additional data binding the ciphertext to its row
  (provider and account), so a ciphertext copied to another row does not decrypt.
- A keyring from one environment variable, `SOFTURE_CONNECTIONS_KEYS=<id>:<base64 32 bytes>[,<id>:<key>…]`: the first
  key encrypts, every key decrypts. The key id is stored per row, so rotation is: put a new key first, run the
  re-encryption, drop the old key.

## Concurrency

A refresh is a network call, so it must not run inside a transaction holding a row lock. A lease column taken with a
conditional `UPDATE … WHERE lease_until IS NULL OR lease_until <= now RETURNING` gives one refresher per connection
across processes; the others poll the row until the winner stores the new token, then read it. The winner writes
only while it still holds its lease id (fencing).
