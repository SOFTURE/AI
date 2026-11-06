# Implementation review: metering-footage-charge-rate-1130

Verdict: approved.

- Both asks of #1130 are met: the recorder stores `units` and `reported`; `getChargeRate` answers the settled
  reported charges' amount per unit, or `null` below `minUnits` (and at 0 units, so no division by zero).
- Reserved attributes win over app attributes of the same name (test), so `reported: "true"` cannot be spoofed by the
  recorder's own options; a direct `recordCharge` can still write them, which is the app's own ledger.
- The rate read skips reservations, fallback-priced charges, other steps and non-numeric `units` (test), orders by
  `created_at desc, id desc` and is parameterized; `latest` and `minUnits` are validated before the query.
- No migration, no breaking change: `onCharge`'s second argument is optional and the charge shape is unchanged, so
  marketing-kit's pipeline calls it as before.
- README and CHANGELOG describe the API; English only.
