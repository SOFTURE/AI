import { type DeepPartial, formatMessage, type Locale } from "@softure-ai/core";
import { ChartCursor, type CursorPoint } from "../cursor/chart-cursor.js";
import { getChartsCopy, type ChartsMessages } from "../messages/index.js";
import { dateTicks, formatDateTick } from "../scale/date-ticks.js";
import { linearScale, peakOf, timeScale, troughOf } from "../scale/scale.js";
import { valueTicks } from "../scale/value-ticks.js";
import { timeAxisTicks, valueAxisTicks } from "./axis-ticks.js";
import { ChartPlot } from "./chart-plot.js";
import { cx, seriesSlot } from "./class-names.js";
import { ChartDataTable } from "./data-table.js";
import { ChartFlag } from "./flag.js";
import { layoutFlags } from "./flag-layout.js";
import { edgeAlign, PLOT_HEIGHT, PLOT_WIDTH, toPercent } from "./geometry.js";
import { Legend, LegendItem, LegendSwatch } from "./legend.js";
import { Baseline, GridLines, GuideLine, SeriesLine } from "./lines.js";
import { type ChartSurfaceName, getChartSurfaceAttributes } from "./surface.js";
import { TimeAxis } from "./time-axis.js";
import { ValueAxis } from "./value-axis.js";

/** A point of a time series. */
export interface TimePoint {
  readonly x: Date;
  readonly y: number;
}

export interface LineChartSeries {
  readonly key: string;
  /** The series' name, in the legend, the readout and the table header. */
  readonly label: string;
  /** Points in time order; every series of a chart has the same x values. */
  readonly points: readonly TimePoint[];
  /** A dashed line, to tell apart series that share a colour. */
  readonly dashed?: boolean;
}

/** An annotation: a dashed guide over a date and a chip with its label at the top. Outside the series' dates it is not drawn. */
export interface LineChartFlag {
  readonly key: string;
  readonly x: Date;
  readonly label: string;
}

/** Flags stacked into rows so their chips do not collide (`layoutFlags`), widths in percent of the plot's width. */
export interface LineChartFlagStack {
  /** A flag chip's width in percent of the plot's width: measured, or estimated from the label's length. */
  readonly widthOf: (flag: LineChartFlag) => number;
  /** The least space between two chips in one row, in percent of the plot's width. Default 0. */
  readonly gap?: number;
  /** The most rows of chips; the flags beyond keep their guide and are counted on one "+N" chip below. Default: no limit. */
  readonly maxRows?: number;
}

export interface LineChartProps {
  /** The chart's title: its caption, the table's caption and part of the cursor's name. */
  readonly title: string;
  readonly series: readonly LineChartSeries[];
  readonly flags?: readonly LineChartFlag[];
  /** Stacks colliding flag chips into rows; without it every chip sits on the top row. */
  readonly flagStack?: LineChartFlagStack;
  /** Locale of the labels (`Intl`) and of the built-in copy. */
  readonly locale: Locale;
  /** The app's IANA time zone (core's `config.timezone`): date ticks and dates are calendar days there. */
  readonly timeZone: string;
  /** A value as people read it, for the value axis, the readout and the table. */
  readonly formatValue: (value: number) => string;
  /** A point's date for the readout and the table; a medium date in `timeZone` by default. */
  readonly formatDate?: (date: Date) => string;
  /** How many value labels to aim for (4 by default). */
  readonly valueTickTarget?: number;
  /** How many date labels to aim for (5 by default). */
  readonly dateTickTarget?: number;
  /** Partial copy overrides for the current locale. */
  readonly messages?: DeepPartial<ChartsMessages>;
  /** Where the chart sits (`ChartSurfaceName`); without it the chart follows the page. */
  readonly surface?: ChartSurfaceName;
  readonly className?: string;
}

/** Space above the highest value, in viewBox units, so the peak's stroke is not cut. */
const TOP_GAP = 16;

/**
 * A line chart of time series, rendered on the server: title, value axis, grid, series, flags, time
 * axis, legend, a keyboard and pointer cursor with a live readout, and the data as a visually hidden
 * table. The y domain runs from zero, or from the lowest value when it is negative, to the peak; the
 * baseline stays at zero. Throws a `TypeError` when the series do
 * not share their x values, which is a programming error.
 */
export function LineChart({
  title,
  series,
  flags = [],
  flagStack,
  locale,
  timeZone,
  formatValue,
  formatDate,
  valueTickTarget = 4,
  dateTickTarget = 5,
  messages,
  surface,
  className,
}: LineChartProps) {
  const dates = series[0]?.points.map((point) => point.x) ?? [];
  assertSharedDates(series, dates);
  const copy = getChartsCopy({ locale, messages });
  const showDate = formatDate ?? createDateFormatter(locale, timeZone);

  const start = dates[0] ?? new Date(0);
  const end = dates.at(-1) ?? start;
  const xScale = timeScale({ domain: [start, end], range: [0, PLOT_WIDTH] });
  const peak = peakOf(series.map((entry) => entry.points));
  const trough = troughOf(series.map((entry) => entry.points));
  // Below zero the lowest value gets the same gap as the peak, so its stroke is not cut either.
  const yScale = linearScale({ domain: [trough, peak], range: [trough < 0 ? PLOT_HEIGHT - TOP_GAP : PLOT_HEIGHT, TOP_GAP] });

  const values = valueTicks(peak, valueTickTarget, { min: trough });
  const axisDates = dateTicks({ start, end, target: dateTickTarget, timeZone });
  // Without a calendar boundary in the span (one point, or hours apart), the first date still gets a label.
  const timeTicks = axisDates
    ? timeAxisTicks({ ticks: axisDates.ticks, unit: axisDates.unit, scale: xScale, locale, timeZone, ends: [start, end] })
    : dates.length > 0
      ? [{ key: "start", label: formatDateTick(start, "day", { locale, timeZone }), xPercent: 0, align: "start" as const }]
      : [];
  // A flag outside the drawn dates would sit off the plot.
  const visibleFlags = flags.filter((flag) => flag.x.getTime() >= start.getTime() && flag.x.getTime() <= end.getTime());

  const cursorPoints: CursorPoint[] = dates.map((date, index) => ({
    key: date.getTime(),
    xPercent: toPercent(xScale(date), PLOT_WIDTH),
    heading: showDate(date),
    values: series.map((entry, seriesIndex) => {
      const y = entry.points[index]?.y ?? 0;
      return {
        key: entry.key,
        slot: seriesSlot(seriesIndex),
        yPercent: toPercent(PLOT_HEIGHT - yScale(y), PLOT_HEIGHT),
        label: entry.label,
        value: formatValue(y),
      };
    }),
  }));

  const surfaceAttributes = surface === undefined ? undefined : getChartSurfaceAttributes(surface);

  return (
    <figure {...surfaceAttributes} className={cx("sft-chart", surfaceAttributes?.className, className)}>
      <figcaption className="sft-chart-title">{title}</figcaption>
      <ChartCursor title={title} points={cursorPoints} locale={locale} messages={messages}>
        <ValueAxis ticks={valueAxisTicks({ ticks: values, scale: yScale, format: formatValue })} />
        <ChartPlot overlay={renderFlagChips({ flags: visibleFlags, flagStack, toXPercent: (date) => toPercent(xScale(date), PLOT_WIDTH), copy })}>
          <GridLines ys={values.map((value) => yScale(value))} />
          <Baseline y={yScale(0)} />
          {visibleFlags.map((flag) => (
            <GuideLine key={flag.key} x={xScale(flag.x)} />
          ))}
          {series.map((entry, seriesIndex) => (
            <SeriesLine
              key={entry.key}
              slot={seriesSlot(seriesIndex)}
              dashed={entry.dashed}
              points={entry.points.map((point) => ({ x: xScale(point.x), y: yScale(point.y) }))}
            />
          ))}
        </ChartPlot>
        <TimeAxis ticks={timeTicks} />
      </ChartCursor>
      <Legend>
        {series.map((entry, seriesIndex) => (
          <LegendItem key={entry.key} swatch={<LegendSwatch slot={seriesSlot(seriesIndex)} shape={entry.dashed === true ? "dashed" : "line"} />}>
            {entry.label}
          </LegendItem>
        ))}
      </Legend>
      <ChartDataTable
        caption={title}
        columns={[copy.table.date, ...series.map((entry) => entry.label)]}
        rows={dates.map((date, index) => [showDate(date), ...series.map((entry) => formatValue(entry.points[index]?.y ?? 0))])}
      />
    </figure>
  );
}

interface FlagChipsOptions {
  readonly flags: readonly LineChartFlag[];
  readonly flagStack: LineChartFlagStack | undefined;
  readonly toXPercent: (date: Date) => number;
  readonly copy: ChartsMessages;
}

/** The flag chips, each on its row when stacked; the flags that fit in no row share one "+N" chip below the rows. */
function renderFlagChips({ flags, flagStack, toXPercent, copy }: FlagChipsOptions) {
  const placed = flags.map((flag) => ({ flag, xPercent: toXPercent(flag.x) }));
  if (!flagStack) {
    return placed.map(({ flag, xPercent }) => (
      <ChartFlag key={flag.key} xPercent={xPercent}>
        {flag.label}
      </ChartFlag>
    ));
  }
  const { placements, rows, hiddenCount } = layoutFlags(
    placed.map(({ flag, xPercent }) => ({ x: xPercent, width: flagStack.widthOf(flag), align: edgeAlign(xPercent) })),
    { gap: flagStack.gap, maxRows: flagStack.maxRows },
  );
  const hidden = placed.filter((_, index) => placements[index]?.hidden === true);
  const firstHidden = hidden.reduce<(typeof placed)[number] | undefined>((first, entry) => (first && first.xPercent <= entry.xPercent ? first : entry), undefined);
  return [
    ...placed.map(({ flag, xPercent }, index) => {
      const placement = placements[index];
      if (!placement || placement.hidden) return null;
      return (
        <ChartFlag key={flag.key} xPercent={xPercent} row={placement.row}>
          {flag.label}
        </ChartFlag>
      );
    }),
    firstHidden && (
      <ChartFlag
        key="sft-more-flags"
        xPercent={firstHidden.xPercent}
        row={rows}
        variant="outline"
        className="sft-chart-flag-more"
        title={hidden.map(({ flag }) => flag.label).join(", ")}
      >
        {formatMessage(copy.lineChart.moreFlags, { count: String(hiddenCount) })}
      </ChartFlag>
    ),
  ];
}

function assertSharedDates(series: readonly LineChartSeries[], dates: readonly Date[]): void {
  for (const entry of series) {
    const same = entry.points.length === dates.length && entry.points.every((point, index) => point.x.getTime() === dates[index]?.getTime());
    if (!same) throw new TypeError(`LineChart series "${entry.key}" does not share the x values of the first series`);
  }
}

function createDateFormatter(locale: string, timeZone: string): (date: Date) => string {
  const format = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone });
  return (date) => format.format(date);
}
