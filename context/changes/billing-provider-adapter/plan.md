# Plan: billing-provider-adapter

Input: change.md, backlog-input.md, research.md. Complexity: medium (2 phases). Risk: high (money and webhooks).

## Goal

- A Stripe Checkout payment turns a trial into paid without owner action, once per payment, and a
  full refund takes the paid access away again.

## Approach

| Decision | Choice | Why |
| --- | --- | --- |
| Provider (unknown 1) | Stripe (owner, 2026-10-03) | cards, BLIK and Przelewy24 behind one API |
| Client | `fetch` against `https://api.stripe.com/v1`, form-encoded | the mailing `resend()` pattern; no SDK to pin, tests inject `fetch` |
| Payment mode | one-time Checkout (`mode: "payment"`) | `grantPlan` already stacks periods; a subscription would add a second period anchor |
| Signature (unknown 2) | HMAC-SHA256 over `t.payload`, any `v1` matches, `|now - t| <= 300 s` | Stripe's scheme; the tolerance is the replay window |
| Idempotency (unknown 3) | `billing.payments`, unique (provider, checkout id); insert-or-skip and the grant in one transaction | a replayed or duplicate event (completed + async succeeded) grants once; an event-id table would not catch two events for one session |
| Refund | `charge.refunded` with `refunded: true` → conditional `UPDATE ... WHERE status = 'paid'` + `revoke` | MO-1's revoke exists for refunds; stacked periods are a followup |
| Webhook route | `stripeWebhookRoute` in `/next`, independent of `billing({ payment })` | the example keeps `manual()` for its pricing e2e and still tests the webhook |
| Abuse | no rate limit on the webhook; signature checked before the database | Stripe sends from few addresses; an unsigned request costs one HMAC |
| Failed grant (plan gone, account deleted) | logged with the checkout id, 200, nothing stored | a retry cannot fix it; the owner refunds in Stripe |
| Lock order | account (`key share`), payment, entitlement in record, refund and the privacy erase | the order `changeEntitlement` and the erase already take (`server/entitlements.ts:90`, `server/privacy.ts:74`): no deadlock |

## Phase 1: Module

**Discipline:** TDD.

- Signature, event parsing, checkout request (fake `fetch`), `recordPayment` / `refundPayment` on
  PGlite, privacy (export and erase of payments), the webhook route, messages.
- Manifest and `module.json`: table `payments`, env `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`,
  route `webhook`, the route-handler mount; the health check reads both tables.

## Phase 2: Example app, e2e, docs

- Example webhook route and provider switch, `e2e/billing-stripe.spec.ts`, `e2e/migrations.spec.ts`,
  the sandbox test (`STRIPE_SECRET_KEY` in the CI test job), README.
- Followups: a browser payment in the sandbox end to end; refunds that take back exactly one
  payment's period (today a full refund revokes all paid access); retro research and plan review
  for billing-entitlements and billing-plans-pricing (coordinator, 2026-10-03).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Module

#### Automated
- [x] 1.1 Signature, event, checkout, payment and refund tests pass on PGlite — f84b31c
- [x] 1.2 Route, privacy and messages tests pass; `module.json` equals the manifest — f84b31c
- [x] 1.3 Gates green (typecheck, lint, test) — f84b31c

### Phase 2: Example app, e2e, docs

#### Automated
- [x] 2.1 Example app builds; `e2e/billing-stripe.spec.ts` and the existing specs pass — 870773e
- [x] 2.2 Gates green (typecheck, lint, test, build) — 870773e
