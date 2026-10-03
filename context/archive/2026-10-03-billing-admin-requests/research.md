# Research: billing-admin-requests

Input: change.md, roadmap FU-9, archived MO-2 (`billing-plans-pricing`) and FU-11
(`billing-refund-one-payment`). Depth: deep (money, a migration, personal data, concurrency).
Snapshot: 15fd9ad on claude/project-thread-43muam, 2026-10-04 00:40 Europe/Warsaw.

## Summary

- Requests are not stored: `manual()` hands each one to `onRequest` and returns `requested`
  (`modules/billing/src/manual.ts:16-26`); the example mails it (`examples/next-app/lib/invoice-requests.ts`).
- The admin grants by email through `grantPlanAction` → `grantPlan` (`src/next/actions.ts:56-90`,
  `src/server/plans.ts`), which records nothing: no history, nothing to revoke from.
- `revoke` exists only as an entitlement event that clears all paid access (`src/entitlement.ts`);
  no action exposes it. FU-11 built exactly the reversal a revoke needs: `getRefundEvent`,
  `getUnusedDays`, `moveBackByDays` (`src/refund.ts`) and the locked flow in `refundPayment`
  (`src/server/payments.ts`).
- A lifetime account can still open the order form and request an invoice (`PaymentPage`,
  `src/next/pages.tsx`), and a dated grant to it extends the hidden dated end (FU-11 kept
  `paid_until` under lifetime): invisible either way.
- Recommended: two new tables (`billing.payment_requests`, `billing.manual_grants`) in migration
  `0004`; requests stored when a provider answers `requested`; manual grants recorded with the
  grant `applyPlan` returns; revoke reuses FU-11's reversal; history = manual grants + provider
  payments of one account; lifetime refused on both the payment and the grant path.

## Current state

1. Buyer: `PaymentPage` → `PaymentForm` → `startPaymentAction` → `startPayment` (rate limit
   `billing-payment`, plan check, invoice parse) → `provider.startPayment` → `manual` calls
   `onRequest(request, ctx)`; `ok({ type: "requested" })` shows the confirmation.
2. Admin: `BillingAdminPage` (role `billing({ adminRole })`, else not found) renders `GrantForm`
   (email + plan) → `grantPlanAction` → `findAccountByEmail` → `grantPlan` → `applyPlan` →
   `changeEntitlement` with `getPlanGrant` as the resolver.
3. Provider payments: `recordPayment` locks the account (key share), inserts the payment, calls
   `applyPlan` inside the same transaction (a savepoint) and stores the grant on the row.
4. Refund: `refundPayment` locks account → conditional `UPDATE` of the payment → entitlement
   `FOR UPDATE`, computes the event, `shiftLaterPeriods` moves stored periods of later paid
   payments back by the unused days, then `changeEntitlement`.

## Affected surface

| Area | Files | Why |
| --- | --- | --- |
| Data | `migrations/0004_*.sql`, `src/schema.ts`, `src/server/health.ts` | requests and manual grants tables |
| Requests | `src/server/plans.ts` (`startPayment`), new `src/server/requests.ts` | store on `requested`, list, dismiss |
| Grants | new `src/server/grants.ts` | record a manual grant, grant from a request, revoke, history |
| Reversal | `src/server/payments.ts` | share the take-back with revoke; later periods of both tables move |
| Lifetime | `src/server/plans.ts`, `src/next/pages.tsx` | refuse payment and grant; notice on the payment page |
| Admin UI | `src/next/pages.tsx`, `src/next/actions.ts`, new `src/ui/*` | lists, buttons, account lookup |
| Copy | `src/messages/{en,pl}.ts`, `src/contract.ts` | new codes and texts |
| Privacy | `src/server/privacy.ts` | export and erase both tables |
| Example | `examples/next-app/e2e/billing-pricing.spec.ts`, `migrations.spec.ts` | e2e of the flow, ledger line |
| Docs | `modules/billing/README.md` | §4, §5, §11, §12 |

## Data

- `billing.payments` (0002 + 0003) is shaped for provider checkouts: `checkout_id NOT NULL`,
  `amount`, `currency`, unique `(provider, checkout_id)`. A manual grant has no checkout and may be
  free (a comp), and needs who granted and who revoked it.
- Requests carry invoice details (name, tax id, address): personal data, limits in
  `src/fields.ts` (`INVOICE_LIMITS`: 200, 32, 500).
- Account erasure: `deleteBillingUserData` locks the account and deletes its rows; FKs to
  `auth.users` cascade.

## Tests

- PGlite unit tests per server function (`tests/support.ts`: `createTestBilling`, `createAccount`,
  `readRow`, clock at 2026-10-03 10:00 Warsaw); FU-11's `tests/refund.test.ts` and
  `tests/payments.test.ts` show the stacked-period cases.
- e2e: `examples/next-app/e2e/billing-pricing.spec.ts` registers an admin in Postgres and drives
  the admin page; `migrations.spec.ts` lists the ledger.

## Patterns to follow

- A list with a per-row action and `useActionState`: `modules/mcp-access/src/ui/token-manager.tsx`
  (rows pre-formatted on the server, a danger button per row, error under the row) and its
  actions (`revalidatePath` after a change, zod `catch` parsing of ids).
- Exactly-once state changes: conditional `UPDATE ... WHERE status = ...` (payments, refunds).
- Lock order account (key share) → own row → entitlement (`FOR UPDATE`) from `refundPayment`.
- Classes only from `@softure-ai/ui` (`tests/architecture.test.ts`), copy only from messages.

## Prior work

- MO-2 archive: manual adapter by design stores nothing; the admin page was the minimum.
- FU-11 archive: impl review F1 (stored periods after a refunded one go stale → `shiftLaterPeriods`)
  applies to manual grants as soon as they store periods too.

## SOFTURE modules

Billing is the module; auth gives `authorizeRole`/`requireRole`, ui the primitives
(`Card`, `Button`, `TextField`, `FormError`, `EmptyState`). Nothing else covers it.

## Risks

- A revoke that clears everything would take a customer's paid Stripe periods: revoke must take
  back only the one grant (FU-11's reversal).
- Stored periods of manual grants go stale when a refund or revoke moves access back (FU-11 F1):
  the shift must cover both tables, in both flows.
- Granting a request and dismissing it at once, or two admins granting it: conditional update.
- Invoice details kept forever: data minimisation.

## Relevant lessons

L-001 (build through tsc) and L-002 (Next imports without `.js`) apply to new `/next` code.

## Answers to unknowns

1. **One table or two.** Two new tables, provider payments stay where they are:
   `billing.payment_requests` (what a buyer asked for) and `billing.manual_grants` (what an admin
   granted, with its grant and revoke). A request is not a payment and a manual grant is not a
   checkout; folding them into `billing.payments` would fake `checkout_id`/`amount` and turn a
   comp into money received. The history view reads manual grants and provider payments together.
2. **Retention of invoice details.** Kept only while the request is open: granting or dismissing
   it clears name, tax id and address in the same `UPDATE` (a CHECK keeps closed rows empty). The
   invoice itself lives in the owner's accounting, and `onRequest` still delivers the details.
   Both tables join the privacy export and are erased with the account.
3. **Where requests are stored.** In `startPayment`, after the provider answers `requested`
   (generic: any provider that hands over a request gets it listed). One open request per account
   and plan (partial unique index): asking again refreshes its details instead of piling up rows.
4. **Revoke semantics.** Per manual grant, like a refund: a period loses its unused days (later
   periods of both tables move back), a lifetime ends unless another active manual lifetime or a
   paid lifetime payment remains. Provider payments are not revoked in the admin page; they are
   refunded at the provider (its webhook takes them back).
5. **Lifetime accounts.** `startPayment` refuses with `billing.lifetime_active` and the payment
   page shows a notice instead of the order; the manual grant refuses with the same code. A
   provider webhook still grants (money was taken).
6. **`grant-plan` script.** Not in this change: it needs an `@softure-ai/ops` dependency and a
   `/scripts` export, and the admin page now covers the need; the server API
   (`grantPlanManually`) is what such a script would call. Filed as a followup.
7. **FU-21 boundary.** The refund keeps counting only paid lifetime payments; counting manual
   lifetime grants in the refund is FU-21. Revoke (new here) counts both.

## Open questions

None; decisions above are the defaults for the plan.
