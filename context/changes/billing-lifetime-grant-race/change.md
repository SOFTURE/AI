---
change_id: billing-lifetime-grant-race
title: "Lifetime grants made at once on a new row are refused after the first"
status: active
roadmap_item: FU-33
branch: claude/project-thread-3ronhj
created: 2026-10-04
updated: 2026-10-04
archived_at: null
---

## Intent

The `billing.lifetime_active` refusal of `grantPlanManually` holds when two manual grants race on
an account that has no entitlement row yet: the second grant waits for the first and is refused
when the first gave lifetime access. Today both pass the check, because `lockEntitlementRow` locks
nothing while the row does not exist.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-33).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-33** (roadmap `followups`):

> - **Outcome:** Two lifetime grants (or a lifetime and a period grant) made at once on an account without an entitlement row cannot both pass the `billing.lifetime_active` check: `grantPlanManually` (and every other path that checks lifetime before granting) holds a lock that exists before the row does, and a Postgres test in `tests/lock-races.test.ts` (two connections, order forced by a blocker) proves the second grant is refused.
> - **Unknowns:** Pin the derived row first (insert `ON CONFLICT DO NOTHING`, then `lockEntitlementRow`) vs. a stronger lock on the `auth.users` row (`FOR NO KEY UPDATE`, which would also serialise reads that take `KEY SHARE`); whether `startPayment`'s lifetime check needs the same (it only refuses early; the grant is the real check).
> - **Source:** FU-26 `billing-guard-race-tests` research finding 5; `modules/billing/src/server/grants.ts:41-56`

## Constraints

- Owns: `modules/billing/src/server/grants.ts`, `src/server/entitlements.ts` (the pin),
  `src/server/take-back.ts` (`lockEntitlementRow`'s comment) and `tests/lock-races.test.ts`,
  `tests/grants.test.ts` (lane C, after FU-32; FU-34 and FU-35 are not done here).
- Every refusal of `grantPlanManually` still writes nothing.
- A gap found here is filed as a new FU item, not fixed (owner decision 2026-10-03).
- English only. No release, tag or publish (owner).

## Notes

- Research: kept. The item names two designs and an open question about `startPayment`; the lock
  semantics of the two designs decide the choice, so they are checked against Postgres's lock
  table and the code that takes each lock.
- Framing skipped: the problem is a measured race (FU-26's spike on Postgres 16) with file
  references, checked again on `master` (99c50bc) today; nothing about the problem is in doubt,
  only how to close it.
