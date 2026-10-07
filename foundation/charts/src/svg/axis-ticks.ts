// Axis labels from CH-1's ticks: where each label sits (a percentage of the plot) and what it says.
import { type DateTickUnit, formatDateTick } from "../scale/date-ticks.js";
import type { Scale } from "../scale/scale.js";
import { type EdgeAlign, PLOT_HEIGHT, PLOT_WIDTH, toPercent } from "./geometry.js";

/** A label of the value axis, at a height from the bottom of the plot (0–100 %). */
export interface ValueTick {
  readonly key: string | number;
  readonly label: string;
  readonly fromBottomPercent: number;
}

export interface ValueAxisTicksOptions {
  /** Values to label (`valueTicks`); zero is added at the bottom. */
  readonly ticks: readonly number[];
  /** The y scale of the plot, its range in viewBox units (`[PLOT_HEIGHT, top]`). */
  readonly scale: Scale<number>;
  readonly format: (value: number) => string;
}

/**
 * Labels for the value axis, bottom to top: every tick and zero (at the bottom unless the scale goes
 * below it). `valueTicks` never emits zero; a zero from another source is not doubled.
 */
export function valueAxisTicks({ ticks, scale, format }: ValueAxisTicksOptions): ValueTick[] {
  const values = [0, ...ticks.filter((value) => value !== 0)].sort((first, second) => first - second);
  return values.map((value) => ({
    key: value,
    label: format(value),
    fromBottomPercent: toPercent(PLOT_HEIGHT - scale(value), PLOT_HEIGHT),
  }));
}

/** A label of the horizontal axis (time or numbers), at a percentage of the plot's width. */
export interface TimeTick {
  readonly key: string | number;
  readonly label: string;
  /** A second row under the label (an age under a year, a unit under a value). */
  readonly sublabel?: string;
  readonly xPercent: number;
  readonly align: EdgeAlign;
  /** Hidden on narrow screens, where middle labels touch. */
  readonly minor?: boolean;
}

/** A label of a horizontal axis; the same type as `TimeTick`, named for a numeric axis. */
export type AxisTick = TimeTick;

/**
 * Which labels stay on narrow screens: `edges` keeps only the end labels (every middle one is `minor`), `alternate`
 * keeps every other middle label, `all` hides none. `edges` by default with `ends`, `all` without.
 */
export type NarrowTicks = "edges" | "alternate" | "all";

/** What both horizontal tick builders share. */
interface HorizontalTicksOptions<T> {
  /**
   * The plot's first and last values. Given, they are labelled at the edges (aligned to them) and the
   * ticks within `edgeMargin` of an edge are dropped, or they would run into the edge labels.
   */
  readonly ends?: readonly [start: T, end: T];
  /** Percent of the width kept free next to an edge label (12 by default). */
  readonly edgeMargin?: number;
  /** A second row under each label, e.g. an age under a year. */
  readonly sublabel?: (value: T) => string;
  readonly narrow?: NarrowTicks;
}

export interface TimeAxisTicksOptions extends HorizontalTicksOptions<Date> {
  /** Dates to label (`dateTicks(…).ticks`). */
  readonly ticks: readonly Date[];
  readonly unit: DateTickUnit;
  /** The x scale of the plot, its range in viewBox units (`[0, PLOT_WIDTH]`). */
  readonly scale: Scale<Date, Date | number>;
  readonly locale: string;
  readonly timeZone: string;
}

/**
 * Labels for the time axis. With `ends`, the ends are labelled at the edges and the ticks between
 * them are centred and `minor`; without, every tick is placed by `edgeAlign`.
 */
export function timeAxisTicks({ ticks, unit, scale, locale, timeZone, ...options }: TimeAxisTicksOptions): TimeTick[] {
  return buildHorizontalTicks({
    ticks,
    keyOf: (date) => date.getTime(),
    label: (date) => formatDateTick(date, unit, { locale, timeZone }),
    xPercentOf: (date) => toPercent(scale(date), PLOT_WIDTH),
    ...options,
  });
}

export interface NumberAxisTicksOptions extends HorizontalTicksOptions<number> {
  /** Values to label, e.g. month indexes or years. */
  readonly ticks: readonly number[];
  /** The x scale of the plot, its range in viewBox units (`[0, PLOT_WIDTH]`). */
  readonly scale: Scale<number>;
  readonly format: (value: number) => string;
}

/**
 * Labels for a numeric horizontal axis (a month index, an age): the same edge and narrow-screen rules as
 * `timeAxisTicks`, on a `linearScale`.
 */
export function numberAxisTicks({ ticks, scale, format, ...options }: NumberAxisTicksOptions): AxisTick[] {
  return buildHorizontalTicks({ ticks, keyOf: (value) => value, label: format, xPercentOf: (value) => toPercent(scale(value), PLOT_WIDTH), ...options });
}

interface BuildHorizontalTicksOptions<T> extends HorizontalTicksOptions<T> {
  readonly ticks: readonly T[];
  readonly keyOf: (value: T) => string | number;
  readonly label: (value: T) => string;
  readonly xPercentOf: (value: T) => number;
}

/** The one place with the edge and narrow-screen rules of a horizontal axis. */
function buildHorizontalTicks<T>({ ticks, keyOf, label, xPercentOf, ends, edgeMargin = 12, sublabel, narrow }: BuildHorizontalTicksOptions<T>): TimeTick[] {
  const withSublabel = (value: T) => (sublabel === undefined ? {} : { sublabel: sublabel(value) });

  if (ends === undefined) {
    return ticks.map((value, index) => {
      const xPercent = xPercentOf(value);
      return {
        key: keyOf(value),
        label: label(value),
        ...withSublabel(value),
        xPercent,
        align: edgeAlignOf(xPercent),
        ...minorOf(narrow ?? "all", index, false),
      };
    });
  }

  const [start, end] = ends;
  const middle = ticks
    .map((value) => ({ value, xPercent: xPercentOf(value) }))
    .filter(({ xPercent }) => xPercent > edgeMargin && xPercent < 100 - edgeMargin)
    .map(({ value, xPercent }, index) => ({
      key: keyOf(value),
      label: label(value),
      ...withSublabel(value),
      xPercent,
      align: "center" as const,
      ...minorOf(narrow ?? "edges", index, true),
    }));

  return [
    { key: "start", label: label(start), ...withSublabel(start), xPercent: 0, align: "start" },
    ...middle,
    { key: "end", label: label(end), ...withSublabel(end), xPercent: 100, align: "end" },
  ];
}

/**
 * Whether the middle label at `index` is hidden on narrow screens. With edge labels, `alternate` hides the first
 * one, which would touch the start label.
 */
function minorOf(narrow: NarrowTicks, index: number, hasEdges: boolean): { minor?: true } {
  if (narrow === "all") return {};
  if (narrow === "edges") return { minor: true };
  return index % 2 === (hasEdges ? 0 : 1) ? { minor: true } : {};
}

function edgeAlignOf(xPercent: number): EdgeAlign {
  if (xPercent <= 0) return "start";
  if (xPercent >= 100) return "end";
  return "center";
}
