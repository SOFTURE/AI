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

// A row header in a narrow muted column, a quiet line under every row; on a phone the label sits above its value.
const DETAIL_TABLE_CLASS = [
  "w-full border-collapse text-ui",
  "[&_tr]:border-b [&_tr]:border-border",
  "[&_th]:w-48 [&_th]:py-1.5 [&_th]:pr-3 [&_th]:text-left [&_th]:align-top [&_th]:font-normal [&_th]:text-muted-foreground",
  "[&_td]:py-1.5 [&_td]:align-top [&_td]:wrap-anywhere",
  "max-sm:[&_tr]:block max-sm:[&_tr]:py-1.5 max-sm:[&_th]:block max-sm:[&_th]:w-auto max-sm:[&_th]:py-0 max-sm:[&_td]:block max-sm:[&_td]:py-0",
].join(" ");

function hasValue(row: DetailRow): boolean {
  return row.value !== null && row.value !== undefined && row.value !== "";
}

// An item's details as a label and value table in the Notion table style; nothing renders when no row has a value.
export function DetailTable({ label, rows }: DetailTableProps) {
  const shown = rows.filter(hasValue);
  if (shown.length === 0) return null;
  return (
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
  );
}
