---
change_id: billing-lifetime-grant-race
title: "Lifetime grants made at once on a new row are refused after the first"
status: backlog
roadmap_item: FU-33
branch: null
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

The `billing.lifetime_active` refusal holds when two grants race on an account that has no
entitlement row yet: the second grant waits for the first and is refused.

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-33** (roadmap `followups`):

> ### FU-33: Lifetime grants made at once on a new row are refused after the first
> - **Change ID:** `billing-lifetime-grant-race`
> - **Status:** proposed
> - **Outcome:** Two lifetime grants (or a lifetime and a period grant) made at once on an account without an entitlement row cannot both pass the `billing.lifetime_active` check: `grantPlanManually` (and every other path that checks lifetime before granting) holds a lock that exists before the row does, and a Postgres test in `tests/lock-races.test.ts` (two connections, order forced by a blocker) proves the second grant is refused.
> - **Prerequisites:** FU-32 on `master` (lane C).
> - **Unknowns:** Pin the derived row first (insert `ON CONFLICT DO NOTHING`, then `lockEntitlementRow`) vs. a stronger lock on the `auth.users` row (`FOR NO KEY UPDATE`, which would also serialise reads that take `KEY SHARE`); whether `startPayment`'s lifetime check needs the same (it only refuses early; the grant is the real check).
> - **Risk:** LOW. `lockEntitlementRow` locks nothing while the account has no row (`modules/billing/src/server/take-back.ts:24-26`), so two grants that start before the row exists both read `isLifetime: false`; measured on Postgres 16 by FU-26: two manual lifetime grants at once both succeed and two active lifetime grants are recorded. Access is still right (lifetime), but the history shows a grant the rule forbids, and a period grant can land on top of a lifetime in the same way.
> - **Baseline:** FU-9 `billing-admin-requests`: the lock order is account (key share), entitlement row (`FOR UPDATE`, nothing without a row), own row; `changeEntitlement` handles the first insert, but the lifetime check runs before it. After: the gap is closed and covered by a two-connection Postgres test.
> - **PRD refs:** FR-22.
> - **Source:** FU-26 `billing-guard-race-tests` research finding 5 (`context/archive/2026-10-04-billing-guard-race-tests/research.md`); `modules/billing/src/server/grants.ts:41-56`

## Constraints

- Owns: `modules/billing/src/server/grants.ts`, `src/server/take-back.ts` (`lockEntitlementRow`) and
  `tests/lock-races.test.ts` (lane C, after FU-32).
- English only. No release, tag or publish (owner).

## Notes

- Filed by FU-26 (`billing-guard-race-tests`, 2026-10-04). Reproduction: FU-26's blocker pattern
  (the blocker inserts the account's row and holds it open) with two `grantPlanManually` calls for a
  lifetime plan; both return `Ok`.
