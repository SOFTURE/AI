# Plan: billing-refund-one-payment

Input: change.md, research.md. Complexity: medium.

## Goal

A full refund of one recorded payment takes back only what that payment granted:
- a refunded period shortens paid access by the part of that period not used yet (in local days);
  other periods, manual grants and the trial stay, and a period already used up takes nothing back;
- a refunded lifetime ends lifetime access unless another paid lifetime payment is still `paid`,
  and the dated access the account had beside it stays;
- a repeated refund changes nothing; a payment recorded before this change keeps the old revoke.

**Out of scope:** partial refunds (filed as a followup), manual lifetime grants surviving a paid
lifetime refund (needs FU-9's grant history; filed), FU-9 and FU-6 themselves, any Stripe API call.

## Approach

**Starting point:** `refundPayment` applies `revoke` (`src/server/payments.ts:106`); payments do not
record their grant (`migrations/0002_create_payments.sql`); lifetime drops the dated end
(`src/entitlement.ts:56-57`).

**Chosen:** record each payment's grant and reverse it with a pure shortening event - exact for
stacked payments, keeps manual grants, needs no plan config at refund time.
Rejected: recompute access from the remaining payments - blind to manual grants and trial
extensions, needs the plan list; keep `revoke` - the gap itself.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Grant record | `grant_kind`, `granted_from`, `granted_until` on `billing.payments`, NULL for old rows | a CHECK ties them together; old rows stay valid | research |
| Reversal | event `shorten { until }` (never lengthens) computed by a pure `getRefundEvent` | state machine stays pure; resolver runs under the lock | research |
| Shift amount | the unused part of the refunded window, `[max(from, now), until)`, nothing when it ended | no access already used is charged against later payments, a lapse between payments is safe | plan review C1 |
| Shift unit | local day numbers in the app time zone, time of day kept | no DST drift | research |
| Lifetime | keep `paid_until` under lifetime; a dated grant on lifetime extends it; `end_lifetime` clears the flag | a lifetime refund keeps months bought beside it | research |
| Other lifetime | "another paid lifetime payment" checked after locking the entitlement row | no race with a concurrent lifetime purchase | research |
| Old rows | `revoke`, as before | nothing recorded to reverse | auto |
| Outcome name | `revoked` → `refunded` | describes the effect; unreleased API | auto |

**Critical details:** the grant columns are written in the transaction of the grant, from the
event the resolver last returned (`changeEntitlement` may call it twice on an insert race). Lock
order stays account → payment → entitlement.

## Phase 1: Grant record and per-payment refund

**Discipline:** TDD. **Files:** `modules/billing/migrations/0003_record_payment_grants.sql`,
`src/schema.ts`, `src/contract.ts`, `src/entitlement.ts`, `src/refund.ts`, `src/index.ts`,
`src/server/plans.ts`, `src/server/payments.ts`, `src/server/privacy.ts`, tests.

1. `migrations/0003_record_payment_grants.sql`: drop `entitlements_lifetime_without_end`; add
   `payments.grant_kind text CHECK (IN ('period','lifetime'))`, `granted_from`, `granted_until`
   `timestamptz`, CHECK `payments_grant_shape` (period ⇒ both set and `until > from`; otherwise both
   NULL). Rollback recipe in the header.
2. `src/contract.ts`: `EntitlementEvent` adds `{ type: "shorten"; until: Date }` and
   `{ type: "end_lifetime" }`; `EntitlementRecord.paidUntil` doc: kept under lifetime.
   `PaymentGrant = { kind: "period"; from: Date; until: Date } | { kind: "lifetime" }`.
3. `src/entitlement.ts`: `grant` on lifetime extends `paidUntil`; `grant_lifetime` keeps it;
   `shorten` sets `paidUntil = min(paidUntil, until)` (NULL stays NULL); `end_lifetime` clears
   the flag only.
4. `src/refund.ts` (pure, exported): `getPaymentGrant(event, record, now)` (what a plan event
   added) and `getRefundEvent(record, grant, now, timezone)`: for a period, `shorten` to
   `paidUntil` moved back by the local days of `[max(from, now), until)` (time of day kept; no
   change when `until <= now` or `paidUntil` is NULL); for a lifetime, `end_lifetime`.
5. `src/server/plans.ts`: internal `applyPlan` returns `{ entitlement, grant }`; `grantPlan` keeps
   its signature.
6. `src/server/payments.ts`: `recordPayment` stores the grant; `refundPayment` locks the
   entitlement row, then period → `shorten`, lifetime → `end_lifetime` unless another paid
   lifetime payment exists, NULL kind → `revoke`; outcome `refunded`.
7. `src/server/privacy.ts`: export `grantKind`, `grantedFrom`, `grantedUntil`.

**Tests:**
- pure: `shorten` and `end_lifetime`; grant on lifetime extends and `grant_lifetime` keeps the end
  (`tests/entitlement.test.ts` cases updated); `getRefundEvent` for a future, a running and a used-up
  window, across the October DST change and with a time of day; `getPaymentGrant` per event.
- the CHECK test `entitlements_lifetime_without_end` (`tests/entitlements.test.ts:172`) becomes a
  test that lifetime with an end is stored; the `payments_grant_shape` CHECK refuses bad shapes.
- PGlite: stacked months, refund the first → one month left; refund the second → one month left;
  a refund after the first month was used → the second month untouched; a lapse then a new
  payment, refund the old one → nothing taken;
  monthly beside lifetime → refund monthly keeps lifetime, refund lifetime keeps the month; two
  lifetimes, refund one → lifetime stays; manual grant plus payment → refund keeps the manual
  period; refund during the trial → back to the trial; old row (NULL kind) → revoke; repeated
  refund → duplicate; grant columns stored; constraint refuses a period without dates; export has
  the columns.

**Done when:**
- Automated: refund and grant-record tests pass on PGlite.
- Automated: Gates green (typecheck, lint, test).

## Phase 2: e2e, docs, followups

**Discipline:** test-after. **Files:** `examples/next-app/e2e/billing-stripe.spec.ts`,
`examples/next-app/e2e/migrations.spec.ts`, `modules/billing/README.md`,
`context/foundation/roadmap.md`, `context/backlog/roadmap-followups/`.

1. e2e: two paid checkouts, refund the first → status `paid`, end one month after the trial.
2. `migrations.spec.ts`: `billing 3 record_payment_grants (applied)`.
3. README: §1, webhook table, §5 columns, §12 limitations (partial refunds; manual lifetime; old rows).
4. File FU-19 (partial refund policy) and FU-20 (manual lifetime grant kept on a paid lifetime
   refund, after FU-9).

**Done when:**
- Automated: `npm run e2e` passes `billing-stripe.spec.ts` and `migrations.spec.ts` locally.
- Automated: Gates green (typecheck, lint, test, build).

## Risks and rollback

- Lifetime semantic change surprises a reader → only `resolveEntitlement` reads `paid_until` and
  checks the flag first; tests pin it. Rollback: revert both phases; the migration's header gives
  the SQL to drop the columns and restore the CHECK (after clearing `paid_until` on lifetime rows).
- Wrong shift across DST → day-number arithmetic with a DST test.
- Race with a concurrent lifetime purchase → check under the entitlement lock.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Grant record and per-payment refund

#### Automated
- [x] 1.1 Refund and grant-record tests pass on PGlite — 00c14f9
- [x] 1.2 Gates green (typecheck, lint, test) — 00c14f9

### Phase 2: e2e, docs, followups

#### Automated
- [x] 2.1 `npm run e2e` passes `billing-stripe.spec.ts` and `migrations.spec.ts` locally — f934d38
- [x] 2.2 Gates green (typecheck, lint, test, build) — f934d38
