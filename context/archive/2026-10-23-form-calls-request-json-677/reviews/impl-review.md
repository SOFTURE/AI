---
change_id: form-calls-request-json-677
verdict: approved
---

# Implementation review

Reviewed the diff against plan.md and change.md.

- Scope: both hand-written calls are gone. `token-client.ts` builds the form and the Basic header and calls
  `requestJson({ method: "POST", form, errorSchema })`; `stripe.ts` does the same with Stripe's form. The core range
  waits for the core release (change.md, Before the next release).
- Behaviour, connections: every row of research.md's outcome table holds. An OAuth error is read from a 2xx or 4xx
  answer only; a 429 and a 503 carrying `invalid_grant` stay `refresh_failed` and keep the grant (new tests). A
  provider's `error_description` never leaves (zod strips it; tested). Revocation is `ok` exactly when the old code
  answered true. The success status is reported as 200, since `requestJson` does not return it; no caller reads it.
- Behaviour, billing: `cache: "no-store"` kept through the wrapped `fetch`; the log keeps the status and
  `error.type`/`error.code` and never the message or the key. A redirect is now refused and a network failure is
  logged by its code; both are in the CHANGELOG.
- Testing helper: the fake provider reads a `URLSearchParams` body, so apps whose own calls send text still work.
- Public API: unchanged in both packages; `requestWithConnection` untouched.
- Gates: typecheck and lint (pre-commit), connections 156 and billing 675 tests passing.

Verdict: approved, no changes.
