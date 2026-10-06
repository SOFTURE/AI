export interface ChartDataTableProps {
  /** The chart's title: the table's accessible name. */
  readonly caption: string;
  /** Column headers: the row header's column first. */
  readonly columns: readonly string[];
  /** Formatted cells, one array per row; the first cell is the row's header. */
  readonly rows: readonly (readonly string[])[];
}

/**
 * The chart's data as a table, visually hidden: a screen reader reads every value instead of a
 * picture. Every chart gets one.
 */
export function ChartDataTable({ caption, columns, rows }: ChartDataTableProps) {
  return (
    <table className="sft-chart-visually-hidden">
      <caption>{caption}</caption>
      <thead>
        <tr>
          {columns.map((column, index) => (
            <th key={index} scope="col">
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, cellIndex) =>
              cellIndex === 0 ? (
                <th key={cellIndex} scope="row">
                  {cell}
                </th>
              ) : (
                <td key={cellIndex}>{cell}</td>
              ),
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
