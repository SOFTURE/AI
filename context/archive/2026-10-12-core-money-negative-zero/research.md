---
change_id: core-money-negative-zero
---

# Research: core-money-negative-zero

## Findings

- `foundation/core/src/format.ts` `formatMoney` passes `minor / 10 ** digits` to an `Intl.NumberFormat` with
  `signDisplay: "auto"` (unsigned) or `"exceptZero"` (`signed`). `"auto"` prints a minus for `-0`.
- The issue's proposal (`minor === 0 ? 0 : minor`) covers `-0` only. A second path gives the same output: with
  `rounded: true`, any amount in (-0.5, 0) whole units, e.g. `formatMoney(-40, "PLN", "en", { rounded: true })`,
  rounds to zero inside `Intl` and prints `-PLN 0` (checked on Node 22).
- `signDisplay: "negative"` (ECMA-402 2023, Node >= 20; packages require `>=22`) shows a minus only for a negative
  value that does not round to zero. Checked on Node 22.22: `-0` gives `PLN 0.00`, `-0.4` with no fraction digits
  gives `PLN 0`, `-12.5` gives `-PLN 12.50` (en).
- `"exceptZero"` (the `signed` path) already treats `-0` and amounts rounding to zero as zero, so it needs no change.
- Compact notation goes through the same formatter options, so it inherits the fix.

## Conclusion

Use `signDisplay: "negative"` for the unsigned path. It fixes both paths, keeps every non-zero output, and needs no
special case in code.
