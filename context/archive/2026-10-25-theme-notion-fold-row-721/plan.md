---
change_id: theme-notion-fold-row-721
status: done
---

# Plan: DetailTable and FoldRow (issue #721)

Input: change.md, research.md. Complexity: small (two compositions, no change to existing components).

## Phase 1: DetailTable

Files: `themes/theme-notion/src/notion/DetailTable.tsx`, `src/index.ts`, `tests/notion/DetailTable.test.tsx`.

1. `DetailRow`, `DetailTableProps`, `DetailTable` as in the issue: rows whose value is `null`, `undefined` or `""`
   are left out; nothing renders when none is left; `data-slot="detail-table"`, `data-detail` per row, `th scope=row`.
2. Tests: rows without a value left out, `null` for no values, accessible name, row order.

## Phase 2: FoldRow

Files: `src/notion/FoldRow.tsx`, `src/index.ts`, `tests/notion/FoldRow.test.tsx`. Needs `Tone` and `TONE_COLORS`
from #720 on master.

1. `FoldRowBadge`, `FoldRowProps`, `FoldRow` as in the issue: `<details>` closed by default, summary with chevron,
   title, facts, badges (`tag` variant, `TONE_COLORS[tone] ?? "default"`, `data-badge`, `data-tone`), content with
   the `DetailTable` and children.
2. Tests: closed by default, badges keep order and `data-tone`, badges group left out when empty, facts rendered,
   details table and children inside the content, every `data-slot` name.

## Phase 3: docs

README "Components" names both compositions; CHANGELOG "Unreleased" entry.

## Decisions (auto)

- The look follows the reference implementation class for class (the issue requires an identical look).
- `FoldRow` waits for #720 instead of defining its own tone type, so the package keeps one tone vocabulary.

## Progress

- [x] Phase 1: DetailTable (f4f7018)
- [x] Phase 2: FoldRow (407ce23, after #720 merged in 203cf7e)
- [x] Phase 3: docs (407ce23, README and CHANGELOG with phase 2)
