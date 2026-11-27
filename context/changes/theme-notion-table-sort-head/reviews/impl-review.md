# Implementation review: theme-notion-table-sort-head

Verdict: approve. The diff matches the plan: one composition (`src/notion/TableSortHead.tsx`), the helpers in
`src/notion/sort-rows.ts`, their exports, three messages (`tableSortHead.*`), tests, the gallery case with its fixture
and visual baselines, README and CHANGELOG. One deviation, for the better: the helpers left the `"use client"` module
after the repository test caught it, so a Server Component can call `sortRows` (recorded in Progress). `aria-sort` is
spread only for a sorted column, `data-sort` always; the native button gives Tab, Enter and Space without handlers.
The hidden label sits inside the button after the visible name, so the accessible name starts with the column name.
`sortRows` never mutates its input, keeps empty values last in both directions and negates the comparison instead of
reversing, which the tests prove for equal numbers, dates, an accessor and a custom compare. The shadcn `table.tsx` is
untouched, so upstream parity holds. Chromium shows the labels aligned with the cells in light and dark. No Polish
outside dictionaries; no new dependency.
