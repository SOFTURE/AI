# Plan: billing-admin-requests

Input: change.md, research.md. Complexity: medium. Plan review: reviews/plan-review.md (W1, W2, S1, S2 applied).

## Goal

The billing admin page is where manual payments are run:
- open invoice requests are stored and listed (oldest first) with the account, plan and invoice
  details; **Grant** applies the plan in one click and closes the request, **Dismiss** closes it;
- every manual grant (from a request or from the email form) is recorded with what it added, who
  granted it and when; **Revoke** takes back only what that grant added;
- looking up an account by email shows its access and its history: manual grants and provider
  payments, newest first;
- a lifetime account cannot pay or be granted again (`billing.lifetime_active`), and the payment
  page tells it it has lifetime access.

**Out of scope:** counting manual lifetime grants in a provider refund (FU-21), reminder mail
(FU-6), partial refunds (FU-20), a `grant-plan` ops script (filed as a followup), any Stripe call.

## Approach

**Starting point:** `manual()` stores nothing (`src/manual.ts`), `grantPlanAction` → `grantPlan`
records nothing (`src/next/actions.ts`), the reversal of one grant exists only inside
`refundPayment` (`src/server/payments.ts`).

**Chosen:** two tables in migration `0004`, server functions in `src/server/requests.ts` and
`src/server/grants.ts`, the take-back shared with `refundPayment`, and client lists in `/ui`
rendered by `BillingAdminPage`.
Rejected: manual rows in `billing.payments` - fakes checkout id and amount, turns a comp into
money received; revoke as the `revoke` event - would take a customer's paid periods too.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Tables | `billing.payment_requests`, `billing.manual_grants` | a request and a manual grant are not provider payments | research 1 |
| Storing a request | in `startPayment` after the provider answers `requested`; upsert on the open `(user_id, plan_id)` | generic for any request-type provider; no pile of duplicates | research 3 |
| Invoice retention | details only while open; cleared by the closing `UPDATE`, CHECK enforces | data minimisation | research 2 |
| Closing a request | conditional `UPDATE ... WHERE status = 'open'` | grant/dismiss exactly once | pattern |
| Grant record | `applyPlan`'s grant stored on the `manual_grants` row in the grant's transaction | FU-21 and revoke read it | FU-11 note |
| Revoke | per manual grant, FU-11's reversal; later periods of both tables move back; lifetime ends unless another active manual or paid lifetime | exact, keeps paid periods | research 4 |
| Refund | unchanged semantics, but later manual-grant periods move back too | stored periods stay true | FU-11 F1 |
| Lifetime | `billing.lifetime_active` from `startPayment` and the manual grant; notice on the payment page | tell lifetime apart | roadmap outcome |
| Lock order | account (key share) → request/grant row → entitlement (`FOR UPDATE`) | same as refund, no deadlock | pattern |
| Page refresh | `refresh()` from `next/cache` in the admin actions | the admin page's path is the app's choice, not a module route | auto |
| History source | manual grants + provider payments of one account, merged newest first | the "history of grants per account" | research |

**Critical details:** the request upsert must not reopen a closed row (partial unique index on
`status = 'open'` only). A grant from a request checks the plan and lifetime before closing the
request, so a refusal leaves it open. Ids from forms are parsed as UUIDs before any query.

## Phase 1: Requests, manual grants and revoke on the server

**Discipline:** TDD. **Files:** `modules/billing/migrations/0004_create_requests_and_grants.sql`,
`src/schema.ts`, `src/contract.ts`, `src/index.ts`, `src/server/{requests,grants,payments,plans,privacy,health,index}.ts`,
`tests/{requests,grants,payments,privacy,module,messages}.test.ts`, `src/messages/{en,pl}.ts`
(error codes only).

1. Migration `0004_create_requests_and_grants.sql` with rollback notes:
   - `payment_requests`: `id`, `user_id` (FK cascade), `plan_id`, `invoice_name`,
     `invoice_tax_id`, `invoice_address` (lengths of `INVOICE_LIMITS`), `status` in
     `open|granted|dismissed`, `requested_at`, `closed_at`; CHECKs: `closed_at` iff not open,
     closed after requested, name and address both or neither, closed rows hold no details;
     partial unique index `(user_id, plan_id) WHERE status = 'open'`; index on open by `requested_at`.
   - `manual_grants`: `id`, `user_id` (FK cascade), `plan_id`, `request_id` (unique, FK set null),
     `granted_by`/`revoked_by` (FK `auth.users` set null), `granted_at`, `grant_kind` NOT NULL,
     `granted_from`, `granted_until` (shape CHECK as `payments_grant_shape`), `status`
     `active|revoked`, `revoked_at`; CHECKs: `revoked_at` iff revoked, `revoked_by` only when
     revoked, revoked after granted; index on `user_id`.
2. `schema.ts`, health check reads both tables.
3. `server/requests.ts`: `recordPaymentRequest(ctx, { userId, planId, invoice })` (upsert on the
   open pair), `listOpenRequests(ctx, { limit })` (with the account email, oldest first),
   `dismissPaymentRequest(ctx, requestId)` → `billing.request_closed` when not open.
   `startPayment` calls `recordPaymentRequest` after a `requested` start.
4. `server/grants.ts`:
   - `grantPlanManually(ctx, { userId, planId, adminId, requestId? })`: one transaction; account
     key share → entitlement `FOR UPDATE` → refuse lifetime → close the request when given
     (conditional; `billing.request_closed` otherwise, checked before any write) → `applyPlan` →
     insert the grant row. Returns `{ entitlement, grantId }`.
   - `grantPaymentRequest(ctx, { requestId, adminId })`: reads the open request, checks its plan,
     then `grantPlanManually` with it.
   - `revokeManualGrant(ctx, { grantId, adminId })`: account key share → conditional
     `active → revoked` → entitlement `FOR UPDATE` → take back (shared helper) →
     `billing.grant_revoked` when not active or unknown.
   - `getAccountHistory(ctx, userId)`: manual grants and provider payments, newest first, as a
     discriminated union `{ source: "manual" | "provider", ... }`.
   - `grantPlan` stays for apps, its JSDoc says it records nothing (admin grants go through
     `grantPlanManually`).
5. `server/payments.ts`: extract the take-back (`takeBackGrant`) used by refund and revoke;
   `shiftLaterPeriods` moves later `period` rows of both tables (`payments.status = 'paid'`,
   `manual_grants.status = 'active'`). Refund still counts only paid lifetime payments (FU-21).
6. `startPayment` refuses a lifetime account (`billing.lifetime_active`) after the rate limit and
   plan check; `contract.ts` gains `billing.lifetime_active`, `billing.request_closed`,
   `billing.grant_revoked` and the admin action state type; messages (en, pl) get the codes.
7. Privacy: export `paymentRequests` and `manualGrants` (without the admin ids), erase both.

**Tests (PGlite):** request upsert refreshes details and never reopens a closed one; list order
and email; dismiss once; grant from a request: entitlement, grant row, request closed and its
details cleared, second grant `request_closed`, unknown plan leaves it open; grant to lifetime
refused and request stays open; revoke of a running month moves the end back by its unused days
and a later Stripe period's stored dates move too; revoke of a manual lifetime keeps lifetime when
a paid lifetime exists, ends it otherwise; revoke twice → `grant_revoked`; refund of a Stripe
period moves a later manual grant's dates; history merges and orders both sources; privacy
export/erase include both tables; `startPayment` stores a manual request and refuses lifetime;
CHECKs refuse a closed request with details and a revoked grant without `revoked_at`.
Updated cases: `tests/privacy.test.ts` export compares `paymentRequests` and `manualGrants` with
exact values; `tests/messages.test.ts` lists the three new codes; `tests/payments.test.ts`'s
hand-over test also reads the stored request row.

**Done when:** the tests above pass and the gates are green.

## Phase 2: Admin page, payment page, e2e and docs

**Discipline:** test-after. **Files:** `src/next/{pages,actions,index,next-modules.d}.ts(x)`,
`src/ui/{payment-requests,grant-history,index}.tsx`, `src/messages/{en,pl}.ts`,
`tests/{admin-ui,messages}.test.tsx`, `modules/billing/README.md`,
`examples/next-app/e2e/{billing-pricing,migrations}.spec.ts`, `context/foundation/roadmap.md`,
`context/backlog/roadmap-followups/` (new followup entry).

1. Actions: `grantRequestAction`, `dismissRequestAction`, `revokeGrantAction` (role from the
   session first, zod-parsed id, `refresh()` after a change); `grantPlanAction` records through
   `grantPlanManually` with the admin's id and shows `lifetime_active`; `findAccountAction`
   redirects to `?account=<user id>` (no email in URLs).
2. `/ui`: `PaymentRequestList` (rows pre-formatted on the server, Grant and Dismiss per row, error
   under the row) and `GrantHistory` (rows with a Revoke button on active manual grants).
3. `BillingAdminPage({ searchParams })`: requests card, grant card, history card with the email
   lookup (`findAccountAction`) and `?account=<user id>` showing the account's badge and history;
   each request row links to its account's history.
4. `PaymentPage`: a lifetime account sees a notice instead of the order card.
5. Messages en/pl for the new sections; `tests/admin-ui.test.tsx` renders both lists.
6. e2e (`billing-pricing.spec.ts`): an invoice request shows in the admin list and Grant flips the
   member to paid; the history shows it and Revoke puts the member back on trial; Dismiss removes
   a request; a lifetime member sees the lifetime notice and a grant to them is refused.
   `migrations.spec.ts` gains `billing 4 create_requests_and_grants (applied)`.
7. README: tables, admin page, revoke, retention, `grantPlan` vs `grantPlanManually`, limitations
   §12 updated; followup for the
   `grant-plan` script filed in `roadmap-followups`.

**Done when:** gates and `npm run build` green; `npm run e2e` passes the billing specs and
`migrations.spec.ts` locally.

## Risks and rollback

- Revoke takes too much → per-grant reversal, tests with a Stripe period after a manual one.
- A refusal after closing a request → checks before the conditional update; test.
- Rollback: drop the two tables (migration notes), revert the code; payments and entitlements
  are untouched by the migration.

## Decisions (auto)

- `grant-plan` script → followup (needs an ops dependency; the admin page covers the need).
- Admin page refresh → `refresh()` (`next/cache`), not `revalidatePath` (no admin route in the manifest).

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Requests, manual grants and revoke on the server

#### Automated
- [x] 1.1 Request, grant, revoke, history, refund-shift and privacy tests pass on PGlite — 0d5b298
- [x] 1.2 Gates green (typecheck, lint, test) — 0d5b298

### Phase 2: Admin page, payment page, e2e and docs

#### Automated
- [x] 2.1 `npm run e2e` passes `billing-pricing.spec.ts`, `billing-stripe.spec.ts` and `migrations.spec.ts` locally — 63a224c
- [x] 2.2 Gates green (typecheck, lint, test, build) — 63a224c
