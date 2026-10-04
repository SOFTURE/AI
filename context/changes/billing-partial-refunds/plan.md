# Plan: billing-partial-refunds

Input: change.md, research.md. Complexity: medium.

## Goal

A partial refund of a provider payment changes access by the app's `partialRefunds` policy:
- `pro_rata` (default): each refund takes back the share of the payment's unused days that the
  newly refunded money is of the money not refunded before, rounded down to whole local days; the
  refund that completes the amount takes back every unused day left, so any series of partial
  refunds summing to the full amount ends exactly where one full refund does;
- `keep_access`: a partial refund takes nothing back; the completing refund acts as a full one;
- a lifetime payment keeps lifetime until it is refunded in full (both policies);
- a repeated or stale delivery (cumulative amount not above the stored one) changes nothing;
- the admin history shows a partly refunded payment's refunded amount, and the export carries it.

**Out of scope:** restoring access when a refund fails (`refund.failed`, filed as a followup);
comparing the charge's currency with the payment's (one Checkout charge, same currency); FU-21
(manual lifetime on a paid lifetime refund) and later lane C items; any Stripe API call.

## Approach

**Starting point:** `readRefund` ignores `refunded: false` (`src/stripe-webhook.ts:154-160`);
`refundPayment` flips the row to `refunded` and calls `takeBackGrant`, which takes back all unused
days of a period (`src/server/payments.ts:120-143`, `src/server/take-back.ts:110-126`).

**Chosen:** a cumulative `refunded_amount` per payment and a share argument on the existing
take-back path: the same shift of later periods and the same `shorten` event, with fewer days, and
the payment's own stored period shrunk by those days - one code path for full and partial refunds.
Rejected: a separate partial-refund path - duplicates the lock order and the period shift;
recomputing access from refunded amounts at read time - blind to manual grants, as FU-11 found.

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Policy | `partialRefunds: "pro_rata" \| "keep_access"`, default `pro_rata` | the roadmap asks for a documented default; goodwill refunds need the other | research |
| Share | newly refunded ÷ not refunded before, applied to the unused days now | the last refund's share is exactly 1, so the sum equals a full refund | research |
| Rounding | floor to whole local days | the customer keeps a partial day; the last refund is exact | research |
| State | `payments.refunded_amount bigint NOT NULL DEFAULT 0`, CHECK by status | idempotent cumulative value from `charge.amount_refunded` | research |
| Full | `refunded: true` or cumulative ≥ `amount` (clamped) | Stripe's flag is authoritative, a clamp survives rounding on its side | research |
| Own period | a partial take-back shrinks the payment's `granted_until` by the days taken | the next refund computes its unused days from true dates | research |
| Lifetime / no grant | partial → nothing; completing refund → as a full refund today | no days to share; old rows keep the old rule | research |
| Event shape | new `payment_partially_refunded { paymentId, amountRefunded }` | a discriminated union, not an optional field on the full event | plan |
| `refundPayment` input | `amountRefunded?: number` (cumulative; omitted = full) | keeps today's callers and the e2e unchanged | plan |
| `getRefundEvent` | options object `{ now, timezone, share? }` | five positional inputs break the code rule; unreleased export | plan |
| Outcome | new `partially_refunded { entitlement }` | the route answers 200 for every outcome but `refused` | plan |

**Critical details:** the payment row is re-read `FOR UPDATE` after the entitlement lock, so two
partial refunds of one payment compute their shares from committed values; lock order stays account
→ entitlement → payment. A free checkout (`amount = 0`) refunded in full still flips to `refunded`.

## Phase 1: Partial refunds take back access

**Discipline:** TDD. **Files:** `modules/billing/migrations/0005_record_refunded_amounts.sql`,
`src/schema.ts`, `src/options.ts`, `src/refund.ts`, `src/index.ts`, `src/stripe-webhook.ts`,
`src/server/take-back.ts`, `src/server/payments.ts`, `src/server/grants.ts`, tests.

1. `migrations/0005_record_refunded_amounts.sql`: `ALTER TABLE payments ADD COLUMN refunded_amount
   bigint NOT NULL DEFAULT 0`; `UPDATE ... SET refunded_amount = amount WHERE status = 'refunded'`;
   CHECK `payments_refunded_amount_by_status`: refunded ⇒ `= amount`; paid ⇒ `>= 0 AND (< amount OR
   amount = 0)`. Run against existing rows: the backfill runs before the CHECK is added. Rollback recipe in the header. `src/schema.ts`: the column and the header list.
2. `src/options.ts`: `partialRefunds: z.enum(["pro_rata", "keep_access"]).default("pro_rata")` with
   a doc line; export `PARTIAL_REFUND_POLICIES`.
3. `src/refund.ts`: `RefundShare { refunded; outstanding }`; `getTakenBackDays(grant, { now,
   timezone, share? })` = unused days, or `floor(unused × refunded / outstanding)` when the share is
   below 1; `getRefundEvent(record, grant, { now, timezone, share? })`: lifetime → `end_lifetime`
   only for a full share; period → `shorten` by `getTakenBackDays`, null when 0 days or no dated end.
4. `src/stripe-webhook.ts`: `chargeSchema` reads `amount_refunded` (optional int ≥ 0);
   `refunded: false` with an amount → `payment_partially_refunded { paymentId, amountRefunded }`;
   `amount_refunded` 0 → `ignored`; `refunded: false` without it → `billing.webhook_invalid`.
5. `src/server/take-back.ts`: `TakeBackGrantInput.share?: RefundShare`; a partial share takes
   nothing for a null grant or a lifetime (decided before `hasOtherLifetime` is asked); days from
   `getTakenBackDays`; returns `{ entitlement, days }` where `days` is the number of days actually
   taken (0 whenever no event was applied, e.g. no dated end), so the caller shrinks its own period
   by exactly what moved; `grants.ts` reads `.entitlement`.
6. `src/server/payments.ts`: `RefundPaymentInput.amountRefunded?`; `refundPayment` locks account →
   entitlement → payment (`FOR UPDATE`), computes the cumulative target (clamped), `duplicate` when
   not above the stored amount (or already refunded); full → `status refunded`, `refunded_at`,
   `refunded_amount = amount`; partial → `refunded_amount` only (conditional on the amount read),
   take back by the policy (under `keep_access` nothing: the outcome carries the current
   entitlement), shrink `granted_until` by the days taken when above 0; outcome
   `partially_refunded`. The share is integer math (`floor(unused × refunded / outstanding)`, at
   most 10^8 × 36,600, inside the safe integer range).
   `receiveStripeWebhook` handles the new event.

**Tests:**
- pure (`tests/refund.test.ts`): `getTakenBackDays` for a full share, a half, a share that rounds
  down, a used-up period; `getRefundEvent` partial lifetime → null, partial period → shorten by the
  share; existing cases on the new signature.
- webhook (`tests/stripe-webhook.test.ts`): a partial charge → `payment_partially_refunded` with the
  cumulative amount; `amount_refunded` 0 → ignored; partial without the amount → invalid; full without
  `amount_refunded` → `payment_refunded` (the e2e shape).
- PGlite (`tests/stripe-payments.test.ts`, signed webhook fixtures): half refunded → half the unused
  days gone, `refunded_amount` stored, status `paid`; two halves → the same end as one full refund
  and status `refunded`; a partial then `refunded: true` → full; three uneven refunds over time sum
  to a full refund's end; the same delivery twice → `duplicate`; a stale smaller cumulative →
  `duplicate`; `keep_access` → access unchanged, completing refund takes all; partial of a lifetime
  keeps lifetime, completion ends it; partial of the first of two stacked months shrinks it and
  moves the second's stored dates; a later full refund of the second takes back the right days;
  partial on a pre-grant row takes nothing, its completing refund revokes; a partial refund with no
  dated end left (after an old-row revoke) takes nothing and leaves the stored period as it was;
  a free checkout refunded in full still flips; the CHECK
  refuses `refunded_amount` above `amount` and a refunded row below it.

**Done when:**
- Automated: partial refund tests pass on PGlite and in the pure suites.
- Automated: Gates green (typecheck, lint, test).

## Phase 2: Admin history, export, docs, e2e ledger

**Discipline:** test-after. **Files:** `src/server/grants.ts`, `src/next/pages.tsx`,
`src/messages/en.ts`, `src/messages/pl.ts`, `src/server/privacy.ts`, `modules/billing/README.md`,
`examples/next-app/e2e/migrations.spec.ts`, `context/foundation/roadmap.md`,
`context/backlog/roadmap-followups/`.

1. History entry carries `refundedAmount`; a paid payment with a refunded amount shows
   "Paid, {amount} refunded" (`admin.history.partlyRefunded`, `en` and `pl`).
2. Export: `refundedAmount` on `BillingPaymentData`.
3. README: §3 option row and the policy paragraph, webhook table rows, §5 column, §12 limitations
   (failed refunds keep the days taken; currency not compared).
4. `migrations.spec.ts`: `billing 5 record_refunded_amounts (applied)`.
5. File the failed-refund gap as the next free FU item (README "Adding a gap").

**Tests:** `tests/admin-ui.test.tsx` history line for a partly refunded payment;
`tests/privacy.test.ts` export has `refundedAmount`; `tests/messages.test.ts` keys in both locales.

**Done when:**
- Automated: `npm run e2e` passes `migrations.spec.ts` and `billing-stripe.spec.ts` locally.
- Automated: Gates green (typecheck, lint, test, build).

## Risks and rollback

- Wrong share math leaves days behind after a full series → the "sum equals one full refund" tests
  compare ends exactly. Rollback: revert both phases; the migration header gives the SQL to drop the
  column and its CHECK.
- Concurrent partial refunds of one payment → the payment row is read `FOR UPDATE` after the
  entitlement lock; a conditional update on the read amount backs it.
- Changing `getRefundEvent`'s signature → only `take-back.ts` and tests call it; unreleased.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Partial refunds take back access

#### Automated
- [ ] 1.1 Partial refund tests pass on PGlite and in the pure suites
- [ ] 1.2 Gates green (typecheck, lint, test)

### Phase 2: Admin history, export, docs, e2e ledger

#### Automated
- [ ] 2.1 `npm run e2e` passes `migrations.spec.ts` and `billing-stripe.spec.ts` locally
- [ ] 2.2 Gates green (typecheck, lint, test, build)
