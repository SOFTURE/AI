---
change_id: core-percent-fraction-digits
---

# Research: core-percent-fraction-digits

Sources: `foundation/core/src/format.ts`, `foundation/core/tests/{format,core-formatters-410}.test.ts`,
`foundation/core/README.md`, `foundation/core/CHANGELOG.md`, PR #445 diff, Node 22 ICU output.

- `formatPercent` builds a cached `Intl.NumberFormat` with `style: "percent"`, `maximumFractionDigits: 2`
  (`MAX_PERCENT_FRACTION_DIGITS`) and `signDisplay` `exceptZero` (signed) or `negative`. The cache key is the
  options' JSON, so a new option needs no cache change.
- Node 22: with `minimumFractionDigits = maximumFractionDigits = 1`, `-0.4` bps gives `0.0%` under both
  `negative` and `exceptZero`; `0.206` signed gives `+20.6%`; `0.19` with two digits gives `19.00%`. The
  zero rule holds through `Intl`'s own rounding, no extra code needed.
- `Intl` truncates a fractional digit count (`1.5` behaves as `1`) instead of throwing, so the option is validated.
- PR #445 only widens `locale` to `string` in `formatPercent`'s signature and leaves `FormatPercentOptions` and the
  body alone, so the two changes merge without overlap in logic.
