# Research: billing-lifetime-grant-race

Question: which lock makes the `billing.lifetime_active` check of a manual grant safe before the
account's entitlement row exists, and which other paths need it?

## Sources

| Source | What it gives |
| --- | --- |
| `modules/billing/src/server/grants.ts:41-91` (`grantPlanManually`) | key share on `auth.users`, `lockEntitlementRow`, the lifetime check, the request close, `applyPlan` |
| `modules/billing/src/server/take-back.ts:22-24` (`lockEntitlementRow`) | `SELECT ... FOR UPDATE` on `billing.entitlements`: no row, no lock |
| `modules/billing/src/server/entitlements.ts:95-145` (`changeEntitlement`) | inserts the derived trial with the event applied, `ON CONFLICT DO NOTHING`, then locks |
| `modules/billing/src/server/entitlements.ts` (`pinDerivedTrials`, `getDefaultRecord`) | the derived record reads compute, and the precedent of writing it into a row |
| Postgres 16 docs, "Row-level lock modes" (conflict table) | `FOR KEY SHARE` conflicts only with `FOR UPDATE`; `FOR NO KEY UPDATE` conflicts with `FOR SHARE`, `FOR NO KEY UPDATE`, `FOR UPDATE` |
| `modules/auth/src/server/login.ts:55`, `change-password.ts`, `password-reset.ts` | auth updates `auth.users` rows (a password rehash on login), which takes `FOR NO KEY UPDATE` implicitly |
| `tests/lock-races.test.ts`, `tests/postgres.ts` (FU-26) | the blocker pattern and `waitForLockWaiters` |

## Findings

**F1. Which paths check lifetime before granting.** `grep lifetime_active` over `src/`: only
`grantPlanManually` (`grants.ts:55`) checks inside the grant's transaction; `startPayment`
(`plans.ts:108`) checks before any transaction and only refuses early; `recordPayment` grants
whatever was paid (money taken is recorded, by design) and `grantPlan` records nothing and checks
nothing. So "every other path" is just `grantPlanManually` and `grantPaymentRequest` (which calls
it).

**F2. The race.** With no row, both grants' `lockEntitlementRow` returns at once, both read the
derived record (`isLifetime: false`), and both reach `changeEntitlement`, whose insert serialises
them: the second applies its grant on top of the first's row. Lifetime then lifetime, or lifetime
and a period, both pass and both are recorded as active manual grants.

**F3. Option A, pin the derived row first.** Insert the derived trial (`getDefaultRecord`, exactly
what reads compute) `ON CONFLICT DO NOTHING`, then `lockEntitlementRow`. An insert that conflicts
with an uncommitted insert waits for that transaction, and afterwards the `FOR UPDATE` select (a
new statement under read committed) sees the committed row and queues on it; the lifetime check
that follows reads the first grant's result. Locks stay in billing's own table, in the documented
order (account, entitlement, own row). The pin is invisible to reads (same values), with one
exception: a pinned trial no longer follows a later change of `trial.days` or `trial.startsAt`.
So a refusal after the pin (`billing.request_closed` is the only one: a lifetime refusal needs a
stored row, so nothing was pinned) must delete the row it pinned to keep "every refusal writes
nothing"; the row is uncommitted and locked by the refusing transaction, so nobody else saw it.

**F4. Option B, `FOR NO KEY UPDATE` on `auth.users`.** It would serialise two grants of the account
without a write. The item's note is wrong on one point: it does not serialise `KEY SHARE` readers
(`FOR KEY SHARE` conflicts only with `FOR UPDATE`). But it conflicts with every update of the user
row auth makes (a login's password rehash, a password change), so a grant would wait on auth's
traffic and auth on a grant, and billing would take a stronger lock on another module's table than
it needs. It also leaves the entitlement lock order as is for every other path, so the guarantee
would rest on a second, different lock that only one path takes.

**F5. `startPayment`.** Its check runs outside any transaction and only spares the buyer a payment
that would be refused; the provider's payment is recorded by `recordPayment` whatever the record
says (paid money is never refused). Nothing to change.

## Decisions

| Decision | Choice | Why |
| --- | --- | --- |
| Lock | Option A: pin the derived row, then `lockEntitlementRow` | billing's own table, the documented order, the same insert-then-lock as `changeEntitlement` (F3, F4) |
| Where | `pinEntitlementRow` in `entitlements.ts` (beside `getDefaultRecord`), called by `grantPlanManually` | the only path that checks lifetime under a lock (F1) |
| Refusal after a pin | delete the pinned row before returning `billing.request_closed` | every refusal writes nothing (F3) |
| `startPayment` | unchanged | early refusal only (F5) |

## Open questions

None.
