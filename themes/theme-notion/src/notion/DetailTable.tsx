import type { ReactNode } from "react";

export interface DetailRow {
  /** Unique within the table; kept on the row as `data-detail`. */
  readonly key: string;
  readonly label: string;
  /** `null`, `undefined` or "": nothing to show, the row is left out. */
  readonly value: ReactNode;
}

export interface DetailTableProps {
  /** The table's accessible name. */
  readonly label: string;
  readonly rows: readonly DetailRow[];
}

// A row header in a narrow muted column, a quiet line under every row. The fixed layout keeps the table to its
// container's width whatever a value holds (#1349): a long unbreakable title or a row of buttons wraps or shortens
// inside its cell instead of widening the table past a side panel. Where its frame is narrower than 28rem (a phone,
// or a column beside a side panel) the label sits above its value, so the value keeps the whole width.
const DETAIL_TABLE_FRAME_CLASS = "@container/detail-table w-full min-w-0";
const DETAIL_TABLE_CLASS = [
  "w-full table-fixed border-collapse text-ui",
  "[&_tr]:border-b [&_tr]:border-border",
  "[&_th]:w-48 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:align-top [&_th]:font-normal [&_th]:text-muted-foreground",
  "[&_td]:py-1.5 [&_td]:align-top [&_td]:wrap-anywhere",
  "@max-md/detail-table:[&_tr]:block @max-md/detail-table:[&_tr]:py-1.5 @max-md/detail-table:[&_th]:block @max-md/detail-table:[&_th]:w-auto @max-md/detail-table:[&_th]:py-0 @max-md/detail-table:[&_td]:block @max-md/detail-table:[&_td]:py-0",
].join(" ");

function hasValue(row: DetailRow): boolean {
  return row.value !== null && row.value !== undefined && row.value !== "";
}

// An item's details as a label and value table in the Notion table style; nothing renders when no row has a value.
export function DetailTable({ label, rows }: DetailTableProps) {
  const shown = rows.filter(hasValue);
  if (shown.length === 0) return null;
  return (
    <div data-slot="detail-table-frame" className={DETAIL_TABLE_FRAME_CLASS}>
      <table data-slot="detail-table" className={DETAIL_TABLE_CLASS} aria-label={label}>
        <tbody>
          {shown.map((row) => (
            <tr key={row.key} data-detail={row.key}>
              <th scope="row">{row.label}</th>
              <td>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
