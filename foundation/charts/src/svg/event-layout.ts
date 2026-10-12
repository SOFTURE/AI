// The layout of an event axis, without the DOM: which row each span and milestone takes and the order the keyboard
// steps through them. Server-safe, so an app can lay out its own markup with it.
import type { ChartTone } from "./class-names.js";

interface EventAxisItemBase {
  readonly key: string;
  /** The event's name: on a span's bar and the readout's heading. */
  readonly label: string;
  /** More in the readout after the label, e.g. the dates. */
  readonly detail?: string;
  /** A series colour (`seriesSlot(index)`); wins over `tone`. Series 1 without slot, tone or colour. */
  readonly slot?: number;
  /** A role colour (`ChartTone`). */
  readonly tone?: ChartTone;
  /** An app colour that is no token (a CSS colour or `var(…)`); wins over `slot` and `tone`. */
  readonly color?: string;
}

/** A stretch of time: from `startPercent` to `endPercent` of the axis width, from the same scale as the chart. */
export interface EventAxisSpan extends EventAxisItemBase {
  readonly kind: "span";
  readonly startPercent: number;
  readonly endPercent: number;
}

/** A moment: at `xPercent` of the axis width. */
export interface EventAxisMilestone extends EventAxisItemBase {
  readonly kind: "milestone";
  readonly xPercent: number;
}

export type EventAxisItem = EventAxisSpan | EventAxisMilestone;

/** An item placed on the axis. */
export interface EventAxisEntry {
  readonly item: EventAxisItem;
  /** The item's index in the input. */
  readonly index: number;
  /** The row, from the top: 0 is the milestone row when there are milestones. */
  readonly lane: number;
  /** Where it starts and ends, 0–100 % (a milestone starts and ends at its x). */
  readonly startPercent: number;
  readonly endPercent: number;
}

export interface EventAxisLayout {
  /** Every item, in the order the keyboard steps through them: by start, then end, then input order. */
  readonly entries: readonly EventAxisEntry[];
  /** How many rows the axis needs. */
  readonly lanes: number;
}

/**
 * Milestones on one row at the top, spans packed below into the fewest rows that keep them from overlapping (a span
 * starting where another ends shares its row). Positions are clamped to 0–100 % and a span's ends are put in order.
 */
export function layoutEventAxis(items: readonly EventAxisItem[]): EventAxisLayout {
  const placed = items
    .map((item, index) => ({ item, index, ...getExtent(item) }))
    .sort((a, b) => a.startPercent - b.startPercent || a.endPercent - b.endPercent || a.index - b.index);
  const hasMilestones = placed.some(({ item }) => item.kind === "milestone");
  const firstSpanLane = hasMilestones ? 1 : 0;
  const laneEnds: number[] = [];
  const entries = placed.map((entry): EventAxisEntry => {
    if (entry.item.kind === "milestone") return { ...entry, lane: 0 };
    let lane = laneEnds.findIndex((end) => end <= entry.startPercent);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = entry.endPercent;
    return { ...entry, lane: firstSpanLane + lane };
  });
  return { entries, lanes: firstSpanLane + laneEnds.length };
}

function getExtent(item: EventAxisItem): { startPercent: number; endPercent: number } {
  if (item.kind === "milestone") {
    const x = clampPercent(item.xPercent);
    return { startPercent: x, endPercent: x };
  }
  const start = clampPercent(item.startPercent);
  const end = clampPercent(item.endPercent);
  return { startPercent: Math.min(start, end), endPercent: Math.max(start, end) };
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}
