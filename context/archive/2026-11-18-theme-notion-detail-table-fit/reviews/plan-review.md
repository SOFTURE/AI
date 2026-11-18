# Plan review: DetailTable fit and DocumentRow details

Verdict: approve.

- Covers both asks of #1349 and keeps them additive; the geometry check proves the measured failure (a table wider
  than its column) cannot come back, without a pixel baseline.
- Risk checked: `table-fixed` on a phone, where rows become blocks (`max-sm`), changes nothing; the label column's
  `w-48` already decides the split on a wide screen.
