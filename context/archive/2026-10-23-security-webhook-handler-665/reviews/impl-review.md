---
change_id: security-webhook-handler-665
verdict: approved
---

# Implementation review

Reviewed the diff of 6db41d5 and 1f2c06b against plan.md and the issue's scoping comment.

- Every ask in scope is covered: `handleWebhook` in `/server` with the fixed order and code-only answers
  (413/400/401/400/400/500/200), the README presets as `WEBHOOK_SENDERS`, `signWebhookRequest` over
  `signWebhookBody`, and the README example rewritten on the helper. No new entry point, no new dependency.
- Security: the signature is checked on the raw bytes before any decoding; the schema runs only on a verified body;
  the delivery is recorded only for a valid event; the 500 log line holds the source and the error message, never
  the body or the secret. A schema that accepts `undefined` cannot pass a non-JSON body (parse result is a value).
- Correctness: `recordDeliveryOnce` and `handle` share one transaction; a failing `handle` leaves no row and the
  retry runs the work (tested). A replay skips the work and answers 200 (tested). Configuration bugs throw before the
  body is read (tested with `bodyUsed`).
- Compatibility: additive. The `/signed-request` export list test was updated for the two new exports; two new codes
  with English messages, listed in the CHANGELOG for apps with their own translation.
- Tests: 15 new cases in `tests/webhook.test.ts` (PGlite) and 6 in `tests/webhook-signature.test.ts` (each preset
  round trip, exact GitHub and Shopify headers, header precedence, raw bytes).
- Gates: typecheck, ESLint (zero warnings), the language gate, the security tests (365) and the repository tests pass
  locally.
- Noted, not changed: the issue's `createWebhookRoute` / `/next` entry is left out on purpose (Decisions in
  plan.md); an app writes `export function POST(request) { return handleWebhook(ctx, request, options); }`.

Verdict: approved.
