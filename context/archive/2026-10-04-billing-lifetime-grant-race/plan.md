# Plan: billing-lifetime-grant-race

Input: change.md, research.md. Complexity: low (one lock, one server function, tests).

## Goal

- `grantPlanManually` (and `grantPaymentRequest` through it) pins the account's derived entitlement
  row before it locks the row and checks lifetime, so a second grant that starts while the first
  is open waits for it and sees its result: a lifetime grant made at once with another lifetime or
  a period grant is followed by `billing.lifetime_active`, not by a second active grant.
- Every refusal still writes nothing: a refusal after the pin (`billing.request_closed`) deletes
  the row it pinned.
- Two Postgres tests in `tests/lock-races.test.ts` prove it on two connections with the order
  forced by a blocker, and fail without the pin.

**Out of scope:** `startPayment`'s early check (research F5); `recordPayment` and `grantPlan`
(they check nothing by design, F1); FU-34, FU-35.

## Approach

**Starting point:** `lockEntitlementRow` (`src/server/take-back.ts:22-24`) locks nothing while the
account has no row, so `grantPlanManually`'s check (`src/server/grants.ts:53-55`) reads the derived
record unlocked.

**Chosen:** Option A (research F3): `pinEntitlementRow(ctx, accountCreatedAt, userId)` in
`src/server/entitlements.ts` inserts `getDefaultRecord` `ON CONFLICT DO NOTHING` and says whether
it inserted; `grantPlanManually` reads the account's `createdAt` under its key share, pins, then
calls `lockEntitlementRow`. Rejected: `FOR NO KEY UPDATE` on `auth.users` (F4: conflicts with
auth's own updates, a second lock taken by one path only).

**Key decisions:**
| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Pin | derived trial (`getDefaultRecord`), `ON CONFLICT (user_id) DO NOTHING`, `created_at = updated_at = now` | what reads compute; waits on a concurrent first insert | research F3 |
| Order | account (key share) → pin → `lockEntitlementRow` → lifetime check → request close → `applyPlan` → grant row | the documented lock order; the pin is part of the entitlement step | research F3 |
| Refusal after a pin | `DELETE` the pinned row when the request close finds nothing | every refusal writes nothing | research F3 |
| Signature | `pinEntitlementRow(ctx: Pick<BillingContext, "db" \| "config" \| "clock">, input: { userId, accountCreatedAt })` returns `Promise<boolean>` | two inputs plus context; boolean answers "did it insert" | conventions |

**Critical details:** the pin runs on the grant's `tx`; `applyPlan` then finds a stored row and
updates it (no second insert). The refusal deletes only when this transaction inserted the row.

## Phase 1: Pin before the lifetime check

**Discipline:** TDD. **Files:** `src/server/entitlements.ts`, `src/server/grants.ts`,
`src/server/take-back.ts` (comment), `tests/lock-races.test.ts`, `tests/grants.test.ts`
(plan review S1: the README states no lock order).

1. Tests first (`tests/lock-races.test.ts`, Postgres):
   - two lifetime grants made at once while a blocker holds the account's first insert open: one
     is `Ok`, the other `billing.lifetime_active`; one active lifetime grant is recorded;
   - a lifetime grant answering a request (held at the request close by a blocker that locks the
     request row) and a monthly grant started meanwhile: the monthly grant waits (two lock waiters)
     and is refused with `billing.lifetime_active`; one manual grant recorded.
   Both fail on `master` (first: both `Ok`; second: only one waiter, the wait times out). The
   second race is ordered by the request blocker, not by which waiter wakes first (plan review W1).
2. Test first (`tests/grants.test.ts`, PGlite): a grant for a request that is another account's,
   on an account without a row, leaves no entitlement row.
3. `pinEntitlementRow` in `entitlements.ts`; `grantPlanManually` takes `createdAt`, pins, locks,
   checks; deletes the pinned row on `billing.request_closed` only when it pinned it (plan review W2). Header comments of `grants.ts` and
   `lockEntitlementRow` say the pin comes first.
4. Gates: `npm run typecheck`, `npm run lint`, `npm test` (with `SOFTURE_TEST_POSTGRES_URL` on a
   local Postgres 16), `npm run build`.

## Risks and rollback

- A grant now writes the pinned row even when it then fails with a database error: the transaction
  rolls back, so nothing stays.
- Rollback: revert the commit; no migration, no stored data changes shape.

## Progress

> `- [ ]` pending, `- [x]` done. A phase ends with ` — <commit sha>` on its done items. Never rename items.

### Phase 1: Pin before the lifetime check

#### Automated
- [x] 1.1 Two lifetime grants at once on a new row: the second is refused (Postgres) — baac224
- [x] 1.2 A period grant made while a lifetime grant is open waits and is refused (Postgres) — baac224
- [x] 1.3 A refused grant on an account without a row leaves no row (PGlite) — baac224
- [x] 1.4 Gates green (typecheck, lint, test, build) — baac224
