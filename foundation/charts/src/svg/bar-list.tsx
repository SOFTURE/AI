import { type ChartTone, cx, seriesColourClass } from "./class-names.js";
import { percent } from "./geometry.js";

export interface BarListItem {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** The formatted value, shown at the end of the row. */
  readonly valueLabel: string;
  /** A series colour (`seriesSlot(index)`); wins over `tone`. */
  readonly slot?: number;
  /** A role colour (`ChartTone`). */
  readonly tone?: ChartTone;
  /** An app colour that is no token (a CSS colour or `var(…)`); wins over `slot` and `tone`. */
  readonly color?: string;
}

export interface BarListOptions {
  /** The value of a full bar; the largest value by default. */
  readonly max?: number;
}

export interface BarListProps extends BarListOptions {
  readonly items: readonly BarListItem[];
  readonly className?: string;
}

/** One row as both renderers draw it. */
export interface BarListRow {
  readonly key: string;
  readonly label: string;
  readonly valueLabel: string;
  /** The bar's width, `value / max` as a CSS percentage, 0–100 %. */
  readonly width: string;
  /** The bar's colour class, if it has a slot or a tone. */
  readonly colourClass: string | undefined;
  readonly color: string | undefined;
}

/** The rows of a bar list: each bar `value / max` wide, clamped to 0–100 %; no bar when `max` is not above zero. */
export function getBarListRows(items: readonly BarListItem[], { max }: BarListOptions = {}): BarListRow[] {
  const full = max ?? Math.max(0, ...items.map((item) => item.value));
  return items.map((item) => ({
    key: item.key,
    label: item.label,
    valueLabel: item.valueLabel,
    width: percent(full > 0 ? Math.min(Math.max(item.value / full, 0), 1) * 100 : 0),
    colourClass: seriesColourClass(item),
    color: item.color,
  }));
}

/** The class of a row's bar. */
export function getBarClass(row: BarListRow): string {
  return cx("sft-chart-bar", row.colourClass);
}

/**
 * Labelled horizontal bars with their values: a list a screen reader reads as text (each bar is hidden), so it needs no
 * data table. `renderBarListHtml` writes the same markup outside React.
 */
export function BarList({ items, max, className }: BarListProps) {
  const rows = getBarListRows(items, max === undefined ? {} : { max });
  return (
    <ul className={cx("sft-chart-bar-list", className)}>
      {rows.map((row) => (
        <li key={row.key} className="sft-chart-bar-row">
          <span className="sft-chart-bar-label">{row.label}</span>
          <span aria-hidden="true" className="sft-chart-bar-track">
            <span className={getBarClass(row)} style={{ width: row.width, ...(row.color === undefined ? {} : { "--sft-chart-series": row.color }) }} />
          </span>
          <span className="sft-chart-bar-value">{row.valueLabel}</span>
        </li>
      ))}
    </ul>
  );
}
