/** The parts of a data table in an app's own `<table>` markup (`@softure-ai/ui` has no table component). */
export type DataTableSlot = "headerCell" | "row" | "cell" | "amountCell" | "emptyCell" | "selectedRow" | "stickyColumn";

const CELL_BASE = "px-3 align-middle";

/**
 * The design system's data table, one class string per part:
 * - `headerCell`: a column header, 12 px 500 in `muted` (an amount column's header adds `text-right`);
 * - `row`: 44 px with a `border` hairline, on `surface` so a stuck cell has a background to inherit;
 * - `cell`: a text cell; `amountCell`: an amount, right-aligned in the mono digits, the last column bold;
 * - `emptyCell`: added to a cell that shows `—`, in `muted`;
 * - `selectedRow`: added after `row` with `cn`, the raised surface with the 3 px lime bar and a bold first cell (the
 *   year);
 * - `stickyColumn`: added to the cells of a column stuck to the right while the table scrolls, with a hairline on its
 *   left below `xl` (an inset shadow: a collapsed border does not stick with the cell).
 */
export const DATA_TABLE_LOOK: Readonly<Record<DataTableSlot, string>> = {
  headerCell: `${CELL_BASE} h-10 text-left text-caption font-medium text-muted`,
  row: "h-touch border-b border-border bg-surface",
  cell: CELL_BASE,
  amountCell: `${CELL_BASE} tabular text-right last:font-bold`,
  emptyCell: "text-muted",
  selectedRow: "bg-surface-raised shadow-selected-row [&>:first-child]:font-bold",
  stickyColumn: "sticky right-0 bg-inherit shadow-[inset_1px_0_0_var(--border)] xl:shadow-none",
};
