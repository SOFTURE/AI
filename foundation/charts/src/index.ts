// Public API of @softure-ai/charts: the arithmetic of a chart (no DOM, no React), then the components.
export type { ChartPoint, Interval, Scale } from "./scale/scale.js";
export { linearScale, peakOf, timeScale, toNumber, troughOf } from "./scale/scale.js";
export { valueTicks, YEAR_STEPS, yearTicks } from "./scale/value-ticks.js";
export type { DateTicks, DateTickUnit } from "./scale/date-ticks.js";
export { dateTicks, formatDateTick } from "./scale/date-ticks.js";
export { nearestPointIndex } from "./scale/nearest-point.js";

// SVG primitives: server-renderable, styled by @softure-ai/charts/styles.css on the --sft-chart-* tokens.
export type { EdgeAlign, PlotPoint } from "./svg/geometry.js";
export { edgeAlign, linePath, percent, PLOT_HEIGHT, PLOT_WIDTH, toPercent } from "./svg/geometry.js";
export type { TimeAxisTicksOptions, TimeTick, ValueAxisTicksOptions, ValueTick } from "./svg/axis-ticks.js";
export { timeAxisTicks, valueAxisTicks } from "./svg/axis-ticks.js";
export { seriesSlot } from "./svg/class-names.js";
// The series palette: token order and slot count (the guard is in @softure-ai/charts/testing).
export { SERIES_SLOTS, SERIES_TOKENS, type SeriesToken } from "./palette/series-tokens.js";
export type { ChartPlotProps } from "./svg/chart-plot.js";
export { ChartPlot } from "./svg/chart-plot.js";
export type { GuideLineProps, GuidePattern, SeriesLineProps } from "./svg/lines.js";
export { Baseline, GridLines, GuideLine, SeriesLine } from "./svg/lines.js";
export { isMinorValueTick, ValueAxis } from "./svg/value-axis.js";
export { TimeAxis } from "./svg/time-axis.js";
export type { SwatchShape } from "./svg/legend.js";
export { Legend, LegendItem, LegendSwatch } from "./svg/legend.js";
export { ChartFlag } from "./svg/flag.js";
export type { ChartPinProps } from "./svg/pin.js";
export { ChartPin } from "./svg/pin.js";
export type { ChartDataTableProps } from "./svg/data-table.js";
export { ChartDataTable } from "./svg/data-table.js";

export { type ChartsCopyProps, type ChartsMessages, chartsMessages } from "./messages/index.js";

// The client cursor ("use client").
export type { ChartCursorProps, CursorPoint, CursorValue } from "./cursor/chart-cursor.js";
export { ChartCursor } from "./cursor/chart-cursor.js";

// The composition: a time series line chart with everything above.
export type { LineChartFlag, LineChartProps, LineChartSeries, TimePoint } from "./svg/line-chart.js";
export { LineChart } from "./svg/line-chart.js";
