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
 * Labels for the value axis: zero at the bottom, then every tick. `valueTicks` never emits zero; a
 * zero from another source is not doubled.
 */
export function valueAxisTicks({ ticks, scale, format }: ValueAxisTicksOptions): ValueTick[] {
  return [0, ...ticks.filter((value) => value !== 0)].map((value) => ({
    key: value,
    label: format(value),
    fromBottomPercent: toPercent(PLOT_HEIGHT - scale(value), PLOT_HEIGHT),
  }));
}

/** A label of the time axis, at a percentage of the plot's width. */
export interface TimeTick {
  readonly key: string | number;
  readonly label: string;
  readonly xPercent: number;
  readonly align: EdgeAlign;
  /** Hidden on narrow screens, where middle labels touch. */
  readonly minor?: boolean;
}

export interface TimeAxisTicksOptions {
  /** Dates to label (`dateTicks(…).ticks`). */
  readonly ticks: readonly Date[];
  readonly unit: DateTickUnit;
  /** The x scale of the plot, its range in viewBox units (`[0, PLOT_WIDTH]`). */
  readonly scale: Scale<Date, Date | number>;
  readonly locale: string;
  readonly timeZone: string;
  /**
   * The plot's first and last dates. Given, they are labelled at the edges (aligned to them) and the
   * ticks within `edgeMargin` of an edge are dropped, or they would run into the edge labels.
   */
  readonly ends?: readonly [start: Date, end: Date];
  /** Percent of the width kept free next to an edge label (12 by default). */
  readonly edgeMargin?: number;
}

/**
 * Labels for the time axis. With `ends`, the ends are labelled at the edges and the ticks between
 * them are centred and `minor`; without, every tick is placed by `edgeAlign`.
 */
export function timeAxisTicks({ ticks, unit, scale, locale, timeZone, ends, edgeMargin = 12 }: TimeAxisTicksOptions): TimeTick[] {
  const label = (date: Date) => formatDateTick(date, unit, { locale, timeZone });
  const xPercentOf = (date: Date) => toPercent(scale(date), PLOT_WIDTH);

  if (ends === undefined) {
    return ticks.map((date) => {
      const xPercent = xPercentOf(date);
      return { key: date.getTime(), label: label(date), xPercent, align: edgeAlignOf(xPercent) };
    });
  }

  const [start, end] = ends;
  const middle = ticks
    .map((date) => ({ date, xPercent: xPercentOf(date) }))
    .filter(({ xPercent }) => xPercent > edgeMargin && xPercent < 100 - edgeMargin)
    .map(({ date, xPercent }) => ({ key: date.getTime(), label: label(date), xPercent, align: "center" as const, minor: true }));

  return [
    { key: "start", label: label(start), xPercent: 0, align: "start" },
    ...middle,
    { key: "end", label: label(end), xPercent: 100, align: "end" },
  ];
}

function edgeAlignOf(xPercent: number): EdgeAlign {
  if (xPercent <= 0) return "start";
  if (xPercent >= 100) return "end";
  return "center";
}
