---
change_id: theme-flat-paint-table-shot-784
status: archived
---

# Plan: DataTable look and shot frame (issue #784)

Input: change.md, research.md. Complexity: small (one package, additive).

## Phase 1: DataTable look and shot frame

Files: `themes/theme-flat-paint/src/look/table.ts`, `src/index.ts`, `src/page.css`, `tests/*`, `README.md`,
`CHANGELOG.md`.

1. `src/look/table.ts`: `DataTableSlot` and `DATA_TABLE_LOOK` with slots `headerCell`, `row`, `cell`, `amountCell`,
   `emptyCell`, `selectedRow`, `stickyColumn`, built on theme utilities only.
2. Export from the barrel.
3. `page.css`: `.shot-frame` on `--theme(--radius-card)`, `var(--shadow-shot-frame)`, `var(--paper)`.
4. Tests: the compiled CSS carries the slot map's classes (`shadow-selected-row`, `h-touch`, `sticky`, the inset
   hairline, `xl:shadow-none`) and the `.shot-frame` rule; `cn(row, selectedRow)` keeps the selected background.
5. README (look maps table, page base list), CHANGELOG `Unreleased`.

## Decisions (auto)

- Seven slots instead of the issue's five: `cell` (padding for a text cell) and `emptyCell` (the muted `—`) make the
  documented look complete without app rules; the five named slots are there as named.
- The sticky column stays sticky at every width; only its hairline goes at `xl`, where the table fits.
- The amount header cell is `headerCell` plus `text-right` in the app; no extra slot.

## Progress

- [x] Phase 1: DataTable look and shot frame (e3d5e3a, package tests 42/42)
