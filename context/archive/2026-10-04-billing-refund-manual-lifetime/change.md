---
change_id: billing-refund-manual-lifetime
title: "A manual lifetime grant survives a refunded paid lifetime"
status: archived
roadmap_item: FU-21
branch: claude/fu-21-jknzwq
created: 2026-10-04
updated: 2026-10-04
archived_at: 2026-10-04
---

## Intent

When the admin granted lifetime access by hand and the account also paid for a lifetime that is
later refunded in full, the account keeps lifetime access. Unit tests on PGlite cover it.

Input: [`backlog-input.md`](backlog-input.md) (roadmap item FU-21).

## Context

From [`roadmap.md`](../../foundation/roadmap.md), item **FU-21** (roadmap `followups`):

> ### FU-21: A manual lifetime grant survives a refunded paid lifetime
> - **Outcome:** A refunded paid lifetime keeps lifetime access when the admin also granted it by hand.
> - **Prerequisites:** FU-9 on `master` (its grant history records manual grants).
> - **Unknowns:** Whether FU-9's grant history can be read in the refund's transaction under the entitlement lock; how a manual revoke after a manual lifetime counts.
> - **Risk:** LOW.
> - **Baseline:** FU-11 `billing-refund-one-payment`: a refunded paid lifetime ends lifetime unless another paid lifetime payment exists; manual grants have no payment row (README §12). After: manual lifetime grants count, covered by unit tests.

Today `refundPayment` (`modules/billing/src/server/payments.ts`) asks `takeBackGrant` with
`hasOtherLifetime: () => hasPaidLifetimePayment(tx, userId, payment.id)` only, while
`revokeManualGrant` (`src/server/grants.ts`) already asks both `hasActiveManualLifetime` and
`hasPaidLifetimePayment`.

## Constraints

- Owns `modules/billing/` refunds (`refundPayment`), its README and tests. Lane C: FU-22 and later
  billing items are not done here. Other gaps go to the followups roadmap as new FU items.
- No migration: `billing.manual_grants` already records the grant kind and status (FU-9, `0004`).
- English-only code, comments and commits (AGENTS.md). No release, tag or publish (owner).

## Notes

- Framing skipped: the gap is stated with its outcome and baseline, it is not in doubt and the fix
  mirrors an existing rule (the manual revoke). Research is kept short: it answers the two unknowns.
- Archived 2026-10-04: a full refund of a paid lifetime keeps lifetime access while an active manual
  lifetime grant of the account exists (`refundPayment` asks `hasActiveManualLifetime` beside
  `hasPaidLifetimePayment`, as `revokeManualGrant` does); a revoked manual grant does not count.
