# Research: metering-footage-charge-rate-1130

## Findings

- `modules/metering/src/server/adapters.ts`: `createFootageChargeRecorder` calls `recordCharge` with
  `attributes: { ...options.attributes, item }`. `getFootageAmount` picks `charge.units` (seconds providers),
  `charge.credits` (reported) or `units * creditsPerSecond` (fallback). The choice is not recorded.
- `FootageChargeLike` (read structurally from marketing-kit's `FootageCharge`) has `step`, `item`, `provider`,
  `units`, `credits?`. Nothing per charge for app attributes; `onCharge` is called by the pipeline with one argument.
- `metering.charges.attributes` is `jsonb` of strings with a GIN `jsonb_path_ops` index (migration 0002), which
  serves containment (`attributes @> ...`). Reads in `spend.ts` use raw `sql` through `ctx.db.execute`.
- Attribute values are strings (`ChargeAttributes = Record<string, string>`), so units are stored as `String(units)`
  and read back with a numeric cast guarded by a pattern.
- Tests run on PGlite (`tests/support.ts`), providers `elevenlabs` (credits), `speech` (seconds).

## Options

1. New columns `units numeric`, `reported boolean` (migration 0004). Exact typing, but a migration every app must run.
2. Reserved attributes `units` and `reported`. No migration; the rate read casts with a guard. Chosen: simplest, and
   the issue allows it.
