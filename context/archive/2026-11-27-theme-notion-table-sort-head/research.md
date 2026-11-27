# Research: theme-notion-table-sort-head

## Findings
- `src/ui/table.tsx` is shadcn's table: `TableHead` is a `<th data-slot="table-head">` (34 px high, `px-2`,
  `text-muted-foreground`, `font-normal`, `whitespace-nowrap`). It is kept in parity with shadcn
  (`tests/upstream.test.ts`), so a sortable header belongs in a composition that renders `TableHead`, not in the
  wrapper.
- WAI-ARIA APG "Sortable Table": `aria-sort` goes on the sorted column's header only (`ascending` / `descending`);
  the other headers carry none. The header's content is a `<button>`, so the button is the tab stop and Enter and
  Space toggle natively. The button's name must contain its visible text (axe `label-content-name-mismatch`), so the
  next direction is a visually hidden text inside the button, not an `aria-label` that replaces the column name.
- Patterns to follow: `CopyButton`, `HelpTooltip` and `RowActionsMenu` (a `Button` `variant="ghost"`, a lucide icon
  at `ICON_STROKE_WIDTH` with `aria-hidden`, English defaults from `messages/en.ts`, a prop to replace them).
  Lucide has `ChevronUp`, `ChevronDown` and `ChevronsUpDown`.
- `Array.prototype.sort` is stable (ES2019), so a stable sort needs only a comparator that never reorders equal
  values; descending must negate the comparison, not reverse the result (a reverse flips equal rows).
- Registration a new composition needs (from #1503): `src/index.ts`, README (name sentence, "Copy" list, a section),
  `tests/gallery/cases.tsx` (inventory test), `tests/fixtures/notion-slots.json` (`UPDATE_FIXTURES=1`),
  `tests/behaviour/messages.test.tsx` (every message path), the visual `gallery.png` baselines.

## Risks
- The full-page visual baselines change with a new gallery case; regenerate them in the pinned Chromium (1243 with
  symlinks for 1255, as in earlier theme-notion changes).
