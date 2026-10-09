// SVG lines of the plot, in viewBox units. Every stroke is `non-scaling-stroke` (styles.css): the
// plot stretches to its box and a line must stay as thin as its token says. An app's `className` is
// added next to the package class, never instead of it, so the stroke keeps `non-scaling-stroke`.
import type { CSSProperties } from "react";
import { type ChartTone, cx, type DataAttributes, seriesClass, seriesColourClass, seriesColourStyle, toneClass } from "./class-names.js";
import { linePath, type PathCurve, PLOT_HEIGHT, PLOT_WIDTH, type PlotPoint, smoothLinePath } from "./geometry.js";

/** What every line primitive accepts on top of its geometry. */
export interface LineLookProps extends DataAttributes {
  /** A role colour (`ChartTone`); each primitive has its own default token. */
  readonly tone?: ChartTone;
  /** A series colour (`seriesSlot(index)`) instead of a tone. */
  readonly slot?: number;
  /** Stroke width in screen pixels (the stroke does not scale); the token's width by default. */
  readonly strokeWidth?: number;
  /** Stroke opacity, 0–1. */
  readonly opacity?: number;
  /** Added to the package class. */
  readonly className?: string;
  /** Inline style, applied last: an app colour that is no token goes here (`{ stroke: … }`). */
  readonly style?: CSSProperties;
}

/** The class and style of a line from its look props; the rest of the props are `data-*` attributes. */
function getLineLook(base: string, { tone, slot, strokeWidth, opacity, className, style }: LineLookProps) {
  const series = slot === undefined ? undefined : cx(seriesClass(slot), "sft-chart-stroke-series");
  const colour = series ?? (tone === undefined ? undefined : cx(toneClass(tone), "sft-chart-stroke-tone"));
  const inline: CSSProperties = { strokeWidth, strokeOpacity: opacity, ...style };
  const hasStyle = Object.values(inline).some((value) => value !== undefined);
  return { className: cx(base, colour, className), style: hasStyle ? inline : undefined };
}

export interface GridLinesProps extends LineLookProps {
  /** Heights of the lines, in viewBox units. */
  readonly ys: readonly number[];
  readonly width?: number;
}

/** Horizontal grid lines, drawn before the series so they never cross them. `--sft-chart-grid` by default. */
export function GridLines({ ys, width = PLOT_WIDTH, tone, slot, strokeWidth, opacity, className, style, ...data }: GridLinesProps) {
  const look = getLineLook("sft-chart-grid", { tone, slot, strokeWidth, opacity, className, style });
  return (
    <>
      {ys.map((y) => (
        <line key={y} {...data} className={look.className} style={look.style} x1={0} y1={y} x2={width} y2={y} />
      ))}
    </>
  );
}

export interface BaselineProps extends LineLookProps {
  readonly y?: number;
  readonly width?: number;
}

/** The zero line at the bottom of the plot. `--sft-chart-axis` by default. */
export function Baseline({ y = PLOT_HEIGHT, width = PLOT_WIDTH, tone, slot, strokeWidth, opacity, className, style, ...data }: BaselineProps) {
  const look = getLineLook("sft-chart-baseline", { tone, slot, strokeWidth, opacity, className, style });
  return <line {...data} className={look.className} style={look.style} x1={0} y1={y} x2={width} y2={y} />;
}

/** A guide's pattern: `dashed` for an event (a flag), `dotted` for a second-order marker, `solid` for a rule. */
export type GuidePattern = "dashed" | "dotted" | "solid";

export interface GuideLineProps extends LineLookProps {
  readonly x: number;
  readonly y1?: number;
  readonly y2?: number;
  readonly pattern?: GuidePattern;
}

/**
 * A vertical guide from `y1` to `y2` (the whole height by default), `--sft-chart-cursor` by default. The only place
 * with its dash pattern.
 */
export function GuideLine({ x, y1 = 0, y2 = PLOT_HEIGHT, pattern = "dashed", tone, slot, strokeWidth, opacity, className, style, ...data }: GuideLineProps) {
  const look = getLineLook(cx("sft-chart-guide", `sft-chart-guide-${pattern}`), { tone, slot, strokeWidth, opacity, className, style });
  return <line {...data} className={look.className} style={look.style} x1={x} y1={y1} x2={x} y2={y2} />;
}

/** A series line's pattern: `solid`, `dashed`, or `dotted` (a second-order series). */
export type LinePattern = "solid" | "dashed" | "dotted";

export interface SeriesLineProps extends LineLookProps {
  /** Points in viewBox units, in drawing order. */
  readonly points: readonly PlotPoint[];
  /** An app colour that is no token (a CSS colour or `var(…)`); wins over `slot` and `tone`. */
  readonly color?: string;
  /** `solid` by default; `dashed: true` is the same as `pattern: "dashed"`. */
  readonly pattern?: LinePattern;
  readonly dashed?: boolean;
  /** `linear` (a polyline, the default) or `smooth` (`smoothLinePath`, through every point without overshoot). */
  readonly curve?: PathCurve;
}

/**
 * One series as a line, in its slot's colour (`seriesSlot(index)`), a tone, or an app colour; `--sft-chart-line-width`
 * by default. Without any of the three it draws in series 1.
 */
export function SeriesLine({ points, slot, tone, color, pattern, dashed = false, curve = "linear", strokeWidth, opacity, className, style, ...data }: SeriesLineProps) {
  const drawn = pattern ?? (dashed ? "dashed" : "solid");
  const base = cx("sft-chart-line", seriesColourClass({ slot, tone }), drawn !== "solid" && `sft-chart-line-${drawn}`);
  const look = getLineLook(base, { strokeWidth, opacity, className, style: { ...seriesColourStyle(color), ...style } });
  return <path {...data} className={look.className} style={look.style} d={curve === "smooth" ? smoothLinePath(points) : linePath(points)} />;
}
