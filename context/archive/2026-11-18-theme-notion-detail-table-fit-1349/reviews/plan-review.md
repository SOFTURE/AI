# Plan review: theme-notion-detail-table-fit-1349

Verdict: approve.

- Contract: `table-fixed` with `w-full` keeps `th` at `w-48` and gives `td` the rest; on a phone (`max-sm`) the rows
  are blocks, where the table layout does not apply. No consumer relies on a detail table wider than its container.
- Tests: the geometry test proves the fix where unit tests cannot (layout), and is shown to fail without it.
- Scope: additive prop; no existing case's pixels move, so no baseline refresh is needed.
