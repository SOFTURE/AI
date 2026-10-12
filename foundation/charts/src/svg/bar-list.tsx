import { type ChartTone, cx, seriesColourClass, seriesColourStyle } from "./class-names.js";
import { percent } from "./geometry.js";

export interface BarListItem {
  readonly key: string;
  readonly label: string;
  readonly value: number;
  /** The formatted value, shown at the end of the row; for a missing row, the text that says so. */
  readonly valueLabel: string;
  /** A series colour (`seriesSlot(index)`); wins over `tone`. */
  readonly slot?: number;
  /** A role colour (`ChartTone`). */
  readonly tone?: ChartTone;
  /** An app colour that is no token (a CSS colour or `var(…)`); wins over `slot` and `tone`. */
  readonly color?: string;
  /** No value to draw: an empty track with a dashed outline in the row's colour; left out of the default `max`. */
  readonly missing?: boolean;
  /** A line of text under the bar. */
  readonly description?: string;
}

/** How a row is laid out: `inline` is label | bar | value, `stacked` puts label and value over a full-width bar. */
export type BarListLayout = "inline" | "stacked";

export interface BarListOptions {
  /** The value of a full bar; the largest value of the rows that are not missing by default. */
  readonly max?: number;
  /** `inline` by default. */
  readonly layout?: BarListLayout;
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
  /** The bar's width, `value / max` as a CSS percentage, 0–100 %; 0 % for a missing row. */
  readonly width: string;
  /** The bar's colour class, if it has a slot or a tone. */
  readonly colourClass: string | undefined;
  readonly color: string | undefined;
  /** The row has no bar, only a dashed empty track. */
  readonly missing: boolean;
  readonly description: string | undefined;
}

/** The rows of a bar list: each bar `value / max` wide, clamped to 0–100 %; no bar when `max` is not above zero. */
export function getBarListRows(items: readonly BarListItem[], { max }: BarListOptions = {}): BarListRow[] {
  const full = max ?? Math.max(0, ...items.filter((item) => item.missing !== true).map((item) => item.value));
  return items.map((item) => {
    const missing = item.missing === true;
    return {
      key: item.key,
      label: item.label,
      valueLabel: item.valueLabel,
      width: percent(!missing && full > 0 ? Math.min(Math.max(item.value / full, 0), 1) * 100 : 0),
      colourClass: seriesColourClass(item),
      color: item.color,
      missing,
      description: item.description,
    };
  });
}

/** The class of a row's bar. */
export function getBarClass(row: BarListRow): string {
  return cx("sft-chart-bar", row.colourClass);
}

/** The class of a missing row's track: dashed, in the row's colour. */
export function getMissingTrackClass(row: BarListRow): string {
  return cx("sft-chart-bar-track", "sft-chart-bar-track-missing", row.colourClass);
}

/** The class of the list. */
export function getBarListClass(layout: BarListLayout | undefined, className: string | undefined): string {
  return cx("sft-chart-bar-list", layout === "stacked" && "sft-chart-bar-list-stacked", className);
}

/**
 * Labelled horizontal bars with their values: a list a screen reader reads as text (each bar is hidden), so it needs no
 * data table. `renderBarListHtml` writes the same markup outside React.
 */
export function BarList({ items, max, layout, className }: BarListProps) {
  const rows = getBarListRows(items, max === undefined ? {} : { max });
  return (
    <ul className={getBarListClass(layout, className)}>
      {rows.map((row) => (
        <li key={row.key} className="sft-chart-bar-row">
          <span className="sft-chart-bar-label">{row.label}</span>
          {row.missing ? (
            <span aria-hidden="true" className={getMissingTrackClass(row)} style={seriesColourStyle(row.color)} />
          ) : (
            <span aria-hidden="true" className="sft-chart-bar-track">
              <span className={getBarClass(row)} style={{ width: row.width, ...seriesColourStyle(row.color) }} />
            </span>
          )}
          <span className="sft-chart-bar-value">{row.valueLabel}</span>
          {row.description !== undefined && <span className="sft-chart-bar-description">{row.description}</span>}
        </li>
      ))}
    </ul>
  );
}
