// Public API of @softure-ai/charts: the arithmetic of a chart (no DOM, no React), then the components.
export type { ChartPoint, Interval, Scale } from "./scale/scale.js";
export { linearScale, peakOf, timeScale, toNumber, troughOf } from "./scale/scale.js";
export { valueTicks, YEAR_STEPS, yearTicks } from "./scale/value-ticks.js";
export type { DateTicks, DateTickUnit } from "./scale/date-ticks.js";
export { dateTicks, formatDateTick } from "./scale/date-ticks.js";
export { nearestPointIndex } from "./scale/nearest-point.js";
export { withStepAt } from "./scale/step.js";
export type { StackedBand, StackInput } from "./scale/stack.js";
export { stackSeries } from "./scale/stack.js";

// SVG primitives: server-renderable, styled by @softure-ai/charts/styles.css on the --sft-chart-* tokens.
export type { AreaPathOptions, EdgeAlign, PathCurve, PlotPoint } from "./svg/geometry.js";
export { areaPath, edgeAlign, linePath, percent, PLOT_HEIGHT, PLOT_WIDTH, smoothLinePath, toPercent } from "./svg/geometry.js";
export type {
  AxisTick,
  NarrowTicks,
  NumberAxisTicksOptions,
  TimeAxisTicksOptions,
  TimeTick,
  ValueAxisTicksOptions,
  ValueTick,
} from "./svg/axis-ticks.js";
export { numberAxisTicks, timeAxisTicks, valueAxisTicks } from "./svg/axis-ticks.js";
export type { ChartTone, ChartToneName, DataAttributes } from "./svg/class-names.js";
export { CHART_TONES, seriesSlot } from "./svg/class-names.js";
// The series palette: token order and slot count (the guard is in @softure-ai/charts/testing).
export { SERIES_SLOTS, SERIES_TOKENS, type SeriesToken } from "./palette/series-tokens.js";
export { distinctColors } from "./palette/distinct-colors.js";
export type { ChartPlotProps } from "./svg/chart-plot.js";
export { ChartPlot } from "./svg/chart-plot.js";
export type { ChartSurfaceAttributes, ChartSurfaceName, ChartSurfaceProps } from "./svg/surface.js";
export { CHART_SURFACES, ChartSurface, getChartSurfaceAttributes } from "./svg/surface.js";
export type { BaselineProps, GridLinesProps, GuideLineProps, GuidePattern, LineLookProps, LinePattern, SeriesLineProps } from "./svg/lines.js";
export { Baseline, GridLines, GuideLine, SeriesLine } from "./svg/lines.js";
export type { AreaProps } from "./svg/area.js";
export { Area } from "./svg/area.js";
export type { StackedAreasProps } from "./svg/stacked-areas.js";
export { StackedAreas } from "./svg/stacked-areas.js";
export type { ValueAxisNarrow, ValueAxisProps } from "./svg/value-axis.js";
export { isMinorValueTick, ValueAxis } from "./svg/value-axis.js";
export { TimeAxis } from "./svg/time-axis.js";
export type { LegendItemElement, LegendItemProps, LegendSwatchProps, SwatchShape } from "./svg/legend.js";
export { Legend, LegendItem, LegendSwatch } from "./svg/legend.js";
export type { ChartFlagProps, ChartFlagSize, ChartFlagVariant } from "./svg/flag.js";
export { ChartFlag } from "./svg/flag.js";
export type { ChartPinClassNames, ChartPinProps, ChartPinRing, ChartPinSize, ChartPinVariant } from "./svg/pin.js";
export { ChartPin } from "./svg/pin.js";
export type { ChartDataTableProps } from "./svg/data-table.js";
export { ChartDataTable } from "./svg/data-table.js";
export type { SankeyBox, SankeyItem, SankeyLayout, SankeyLayoutOptions, SankeyNode, SankeySide } from "./svg/sankey-layout.js";
export { layoutSankey } from "./svg/sankey-layout.js";
export type { SankeyAspect, SankeyEntry, SankeyFill, SankeyLabelPlacement, SankeyProps } from "./svg/sankey.js";
export { Sankey } from "./svg/sankey.js";
export type { BarListItem, BarListLayout, BarListOptions, BarListProps, BarListRow } from "./svg/bar-list.js";
export { BarList, getBarListRows } from "./svg/bar-list.js";
export { renderBarListHtml } from "./svg/bar-list-html.js";

export { type ChartsCopyProps, type ChartsMessages, chartsMessages } from "./messages/index.js";

// The client cursor ("use client").
export type { ChartCursorProps, CursorPoint, CursorValue } from "./cursor/chart-cursor.js";
export { ChartCursor } from "./cursor/chart-cursor.js";
export type { EventAxisProps } from "./cursor/event-axis.js";
export { EventAxis } from "./cursor/event-axis.js";
export type { EventAxisEntry, EventAxisItem, EventAxisLayout, EventAxisMilestone, EventAxisSpan } from "./svg/event-layout.js";
export { layoutEventAxis } from "./svg/event-layout.js";

// The composition: a time series line chart with everything above.
export type { LineChartFlag, LineChartProps, LineChartSeries, TimePoint } from "./svg/line-chart.js";
export { LineChart } from "./svg/line-chart.js";
