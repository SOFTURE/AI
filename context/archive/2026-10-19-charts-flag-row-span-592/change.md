---
change_id: charts-flag-row-span-592
title: "charts: layoutFlags and ChartFlag take a flag that spans several rows (issue #592)"
status: archived
roadmap_item: null
issue: 592
branch: claude/project-thread-9475ks
created: 2026-10-19
updated: 2026-10-19
archived_at: 2026-10-19
---

## Intent

Close [issue #592](https://github.com/SOFTURE/AI/issues/592): `layoutFlags` gives every flag exactly one row, so an
app that draws a two-line chip (two close dates merged into one chip) post-processes the placements to lift the
flags it collides with. A flag should be able to say how many rows it is tall.

## Context

Labels: `enhancement`, `pkg: charts`, `adoption`. charts 0.4.0 is the latest on npm and on master (`layoutFlags`
came in #559). Releases are batched by the coordinator: no version bump here, the CHANGELOG gets `## Unreleased`.

## Acceptance

- `FlagLayoutInput` takes an optional `rows` (whole number of at least 1, default 1). A flag with `rows: n` takes
  its row and the `n - 1` rows below it; a flag takes a row only where every row it spans is free at its extent
  (at least `gap` from every chip already there).
- `FlagLayout.rows` counts the spanned rows; `maxRows` applies to them: a flag whose span would end below `maxRows`
  is hidden there.
- A `rows` that is not a whole number of at least 1 throws a `RangeError`.
- `ChartFlag` takes `rows` too, so a spanning chip fills its rows and lands at its row's offset like a one-row chip.
- One-row flags lay out and render exactly as before; the output of every existing call is unchanged.

## Notes

- Framing: skipped. The issue states the problem and the proposal.

## Decisions (auto)

- The field is `rows` (the issue's first name), counted in rows, default 1.
- Placements stay `{ hidden, row, start, end }` with `row` the top row: the caller already knows each flag's span,
  and adding a field would change every existing placement object.
- `ChartFlag` also takes `rows`: its `row` moves a chip by its own height, which for a taller chip is more than one
  row, so a spanning chip below row 0 would land too low. With `rows`, the chip is as tall as its rows and moves by
  one row per row. Without it nothing changes.
- `LineChart`'s `flagStack` stays as is: its labels are one-line chips. The issue's `direction` (upward stacking) is
  out of scope, as the issue says.
