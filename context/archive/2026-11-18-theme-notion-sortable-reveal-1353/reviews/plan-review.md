# Plan review: a SortableHandle that shows on hover (#1353)

Verdict: approve.

- Additive and opt-in; the default keeps every current list and baseline unchanged.
- happy-dom evaluates no media queries, so the plan checks the generated CSS in a unit test and the real behaviour in a
  browser (Phase 2); together they cover the four cases the issue asks to test.
- Risk: `pointer-fine:` and `group-data-dragging/sortable-item:` must compile in the package's Tailwind; the class test
  (`tailwind-classes.test.ts`) fails otherwise.
