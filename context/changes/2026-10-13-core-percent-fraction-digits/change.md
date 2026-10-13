---
change_id: core-percent-fraction-digits
title: "core: fixed fraction digits in formatPercent (issue #455)"
status: open
roadmap_item: null
issue: 455
branch: claude/project-thread-izg7m1
created: 2026-10-13
updated: 2026-10-13
---

## Intent

Close [issue #455](https://github.com/SOFTURE/AI/issues/455) (labels `enhancement`, `pkg: core`): `formatPercent`
always formats with at most two fraction digits and no minimum, so tables cannot show `19.00%` or `+3.0%`. An app
keeps its own percent formatters next to core's and loses core's guarantees (no signed zero, the `RangeError` on a
non-finite input, `tight`, `signed`).

`FormatPercentOptions` gains `fractionDigits`: the exact number of fraction digits. A value that rounds to zero at the
chosen precision prints unsigned (`0.0%`, never `-0.0%` or `+0.0%`).

A reviewer checks `foundation/core/tests/core-percent-fraction-digits-455.test.ts`, the README and the CHANGELOG
`Unreleased` entry.

## Context

core is at 0.1.11 on master. #438 (PR #445) changes the same file (`locale` widened to `string`, duration messages);
this change is independent of it and merges master in before READY. Releases are batched by the coordinator, so no
version bump.

## Constraints

- Additive: without `fractionDigits` every call keeps its output (at most two digits, no minimum).
- English only; no copy is added.

## Notes

- Framing: skipped. The issue names the gap and the API it wants.

## Decisions (auto)

- One option, `fractionDigits?: number`, setting both `minimumFractionDigits` and `maximumFractionDigits` (the
  issue's first proposal). Separate minimum and maximum are left out: no caller asked for a range, and a fixed
  precision is what tables need.
- `fractionDigits` must be an integer from 0 to 20; anything else throws a `RangeError` naming the value (`Intl`
  would silently truncate `1.5`). 20 is the bound every `Intl` engine accepts.
