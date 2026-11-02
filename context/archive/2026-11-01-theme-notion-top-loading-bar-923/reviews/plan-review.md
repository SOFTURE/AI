---
change_id: theme-notion-top-loading-bar-923
verdict: approved
---

# Plan review

Reviewed against change.md, research.md and master (3bb947e).

- Issue ask 1 (TopLoadingBar, indeterminate Progress): Phase 2; the indeterminate state is keyed on Radix's own
  `data-state`, so `Progress` with a value is unchanged.
- Ask 2 (`rootSlot`): Phase 1, optional and validated, so it is safe inside the attribute selector.
- Ask 3 (picking in the browser): `RouteLoading` with media queries, no request reading.
- Risk: the counter writing `data-state` disagrees with React's hydration of the same attribute; only a development
  warning, as for the `aria-valuenow` it already writes. Accepted.
- Risk: two counters run when both are rendered; the hidden one is cheap and stops at 99 or when replaced. Accepted.

Verdict: approved, no changes.
