# Plan: metering-footage-charge-rate-1130

## Phases

1. Recorder: every footage charge stores the reserved attributes `units` (the billed seconds, `String(units)`) and
   `reported` (`"true"` when the amount is the provider's reported credits, `"false"` for a `creditsPerSecond`
   fallback or a seconds count). They win over app attributes of the same name, like `item`. `onCharge(charge,
   attributes?)` takes optional per-charge attributes, merged over the recorder's. Tests first.
2. `getChargeRate(ctx, { provider, step, accountId?, latest?, minUnits? })` in `src/server/rates.ts`: over the latest
   `latest` (default 20, integer 1 to 1000) settled charges of the provider and step (and account) with
   `reported: "true"` and numeric `units`, `ok({ provider, unit, step, accountId, rate, amount, units, charges })`
   where `rate = amount / units`; `ok(null)` when there are none or their units are below `minUnits` (default 0,
   so zero units also give null). Invalid input throws (bug). Type `ChargeRate` in `contract.ts`. Tests first.
3. Docs and release: README (function table, hooks section), CHANGELOG 0.4.0, version bump in package.json and the
   lockfile.

## Acceptance

- Tests in `modules/metering/tests/adapters.test.ts` and `tests/rates.test.ts`: units and reported stored for
  reported, fallback and seconds charges; per-charge attributes; rate over the latest N, the account filter,
  ignoring reservations, fallback charges and other steps; null below `minUnits`; invalid input throws.
- Gates: typecheck, lint, metering tests, build.

## Decisions (auto)

- Reserved attributes instead of columns: no migration (research option 2).
- `reported` is `"false"` for a seconds-billed provider: its amount is the measured seconds, not a reported cost.
- Per-charge attributes as a second `onCharge` argument, so `FootageChargeLike` stays the shape marketing-kit sends.
- Minor bump 0.4.0: new API, no breaking change.

## Progress

- [x] p1 recorder keeps units, reported, per-charge attributes; tests written first and failing (8 failed), then green
- [x] p2 getChargeRate in `src/server/rates.ts`, `ChargeRate` in `contract.ts`; `npx vitest run modules/metering` 8 files, 77 tests passed
- [x] p3 README (function table, hooks section), CHANGELOG `## Unreleased`, then `npm run release:version -- metering minor` (0.4.0)
