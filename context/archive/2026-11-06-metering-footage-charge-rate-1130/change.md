---
change_id: metering-footage-charge-rate-1130
title: "feat(metering): keep a footage charge's units and reported flag, answer a provider rate from the ledger"
status: archived
roadmap_item: null
issue: 1130
branch: claude/project-thread-nz5iy3
created: 2026-11-06
updated: 2026-11-06
archived_at: 2026-11-06
---

## Intent

An adopting app estimates a credits-billed footage step before asking the owner and wants the estimate to use the
rate the provider really bills. The outcome: the footage recorder keeps each charge's billed units and whether its
amount was the provider's reported cost, an app can add attributes per charge, and `getChargeRate` answers the
amount per unit over the latest settled reported charges of a step, or `null` below a minimum of units.

## Context

Issue #1130. Today `createFootageChargeRecorder` stores only the amount and `{ ...attributes, item }`; units are
dropped and a fallback amount (`creditsPerSecond` times the seconds) cannot be told apart from a reported one, so the
app reads `metering.charges` with its own SQL.

## Constraints

- No migration: the units and the flag are reserved attributes (`units`, `reported`), which the issue allows.
- Backward compatible: existing calls of the recorder keep working; old rows without the attributes are ignored by
  the rate read.
- English only.

## Notes

- Framing: skipped. The issue names the gap and the two asks.

## Done

- `createFootageChargeRecorder` stores the reserved attributes `units` and `reported` on every footage charge;
  `onCharge(charge, attributes?)` takes per-charge attributes.
- `getChargeRate(ctx, { provider, step, accountId?, latest?, minUnits? })` answers the amount per unit of the latest
  settled reported charges, or `null`.
- README, CHANGELOG; `@softure-ai/metering` 0.4.0 (released by the combined release after the merge).
