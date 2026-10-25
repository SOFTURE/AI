---
change_id: theme-notion-fold-row-721
verdict: approved
---

# Implementation review

Reviewed the diff against change.md, plan.md and the issue's API, reference implementation and acceptance list.

- API: `DetailRow`, `DetailTableProps`, `FoldRowBadge`, `FoldRowProps` match the issue field for field, all
  `readonly`; both components and their types are exported from the package root.
- Look: the class strings are the reference implementation's, unchanged; the classes live in `src/notion/`, a theme
  source, so the shipped `theme.css` generates them.
- Behaviour: rows with `null`, `undefined` or `""` are left out, `0` is kept; `null` when no row is left; `<details>`
  without `open`; a badge without a tone gets `data-tone="default"` and the `default` tag colour.
- `data-slot` names kept: `detail-table`, `fold-row`, `fold-row-summary`, `fold-row-heading`, `fold-row-fact`,
  `fold-row-badges`, `fold-row-content`.
- No built-in copy: every text comes by props. Tones come from #720's `tones.ts`, not duplicated.
- Tests cover each acceptance point; README and CHANGELOG describe what an app replaces.

Verdict: approved, no changes.
