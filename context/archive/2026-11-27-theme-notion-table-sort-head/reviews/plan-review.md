# Plan review: theme-notion-table-sort-head

Verdict: approve. A composition around `TableHead` keeps shadcn parity and still gives the `<th>` its `aria-sort`, as
the APG sortable table pattern wants (only on the sorted column). A native `<button>` covers the keyboard ask without
key handlers. Hidden text inside the button keeps the visible column name in the accessible name, which an
`aria-label` would break. Negating the comparison instead of reversing the sorted array is what keeps equal rows in
order when descending; the tests cover both directions. The `align` prop covers right-aligned number columns, which a
table of amounts needs. A minor release fits new exports.
