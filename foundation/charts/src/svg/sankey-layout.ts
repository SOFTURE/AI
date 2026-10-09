// A two-sided Sankey in viewBox units: inputs on the left flow into one hub in the middle, which flows out to the
// outputs on the right. No DOM, no React: `Sankey` draws it, an app with its own drawing can use the numbers.
import { PLOT_HEIGHT, PLOT_WIDTH } from "./geometry.js";

/** Which side of the hub a node sits on: `in` flows into it, `out` flows out of it. */
export type SankeySide = "in" | "out";

/** What the layout needs of an item; anything else on it is passed through to its node. */
export interface SankeyItem {
  readonly key: string;
  readonly side: SankeySide;
  /** The flow's size; below zero counts as zero. */
  readonly value: number;
}

export interface SankeyLayoutOptions {
  /** The viewBox, `PLOT_WIDTH` × `PLOT_HEIGHT` by default. */
  readonly width?: number;
  readonly height?: number;
  /** Width of a node bar and of the hub (24 by default). */
  readonly nodeWidth?: number;
  /** Space between two nodes on one side (16 by default); shrinks when the gaps would take over half the height. */
  readonly gap?: number;
  /** Least distance between two label centres on one side (48 by default, two lines at the default plot height). */
  readonly labelSpacing?: number;
}

/** A box in viewBox units. */
export interface SankeyBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface SankeyNode<T extends SankeyItem> extends SankeyBox {
  readonly item: T;
  /** The `d` of the closed ribbon between the node and its slice of the hub. */
  readonly link: string;
  /** Where the node's label is centred: the node's middle, moved apart from crowded neighbours. */
  readonly labelY: number;
}

export interface SankeyLayout<T extends SankeyItem> {
  readonly inputs: readonly SankeyNode<T>[];
  readonly outputs: readonly SankeyNode<T>[];
  readonly hub: SankeyBox;
  /** The larger of the two sides' sums: the hub's value. */
  readonly total: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Lays out a two-sided Sankey: each side stacked top to bottom in the items' order with `gap` between nodes, one scale
 * for both sides and the hub (so a ribbon is as tall at both ends), each side and the hub centred vertically.
 */
export function layoutSankey<T extends SankeyItem>(items: readonly T[], options: SankeyLayoutOptions = {}): SankeyLayout<T> {
  const { width = PLOT_WIDTH, height = PLOT_HEIGHT, nodeWidth = 24, gap = 16, labelSpacing = 48 } = options;
  const inputs = items.filter((item) => item.side === "in");
  const outputs = items.filter((item) => item.side === "out");
  const total = Math.max(sumOf(inputs), sumOf(outputs));
  const gaps = Math.max(inputs.length, outputs.length) - 1;
  const usedGap = gaps > 0 ? Math.min(gap, height / 2 / gaps) : 0;
  const scale = total === 0 ? 0 : (height - usedGap * gaps) / total;
  const hubHeight = total * scale;
  const hub: SankeyBox = { x: (width - nodeWidth) / 2, y: (height - hubHeight) / 2, width: nodeWidth, height: hubHeight };
  const side = (sideItems: readonly T[], x: number, isInput: boolean): SankeyNode<T>[] => {
    const heights = sideItems.map((item) => sizeOf(item) * scale);
    const stacked = heights.reduce((sum, nodeHeight) => sum + nodeHeight, 0) + usedGap * Math.max(sideItems.length - 1, 0);
    let y = (height - stacked) / 2;
    let hubY = hub.y;
    const boxes = heights.map((nodeHeight) => {
      const box = { x, y, width: nodeWidth, height: nodeHeight, hubY };
      y += nodeHeight + usedGap;
      hubY += nodeHeight;
      return box;
    });
    const labels = spreadLabels(
      boxes.map((box) => box.y + box.height / 2),
      labelSpacing,
      height,
    );
    return sideItems.map((item, index) => {
      const { hubY: sliceY, ...box } = boxes[index] ?? { x, y: 0, width: nodeWidth, height: 0, hubY: 0 };
      const link = isInput
        ? ribbonPath({ x0: box.x + box.width, top0: box.y, x1: hub.x, top1: sliceY, height: box.height })
        : ribbonPath({ x0: hub.x + hub.width, top0: sliceY, x1: box.x, top1: box.y, height: box.height });
      return { ...box, item, link, labelY: labels[index] ?? 0 };
    });
  };
  return { inputs: side(inputs, 0, true), outputs: side(outputs, width - nodeWidth, false), hub, total, width, height };
}

function sizeOf(item: SankeyItem): number {
  return Math.max(item.value, 0);
}

function sumOf(items: readonly SankeyItem[]): number {
  return items.reduce((sum, item) => sum + sizeOf(item), 0);
}

/** A band of constant `height` from (x0, top0) to (x1, top1), its edges cubic S-curves with handles halfway across. */
function ribbonPath({ x0, top0, x1, top1, height }: { x0: number; top0: number; x1: number; top1: number; height: number }): string {
  const mid = round((x0 + x1) / 2);
  const [a, b, t0, t1, b0, b1] = [x0, x1, top0, top1, top0 + height, top1 + height].map(round);
  return `M${a} ${t0} C${mid} ${t0} ${mid} ${t1} ${b} ${t1} L${b} ${b1} C${mid} ${b1} ${mid} ${b0} ${a} ${b0} Z`;
}

/**
 * Label centres at least `spacing` apart and at least half a spacing from either edge, each as near its node as that
 * allows: pushed down from the top, then up from the bottom. When they cannot fit, the spacing shrinks to fit.
 */
function spreadLabels(centres: readonly number[], spacing: number, height: number): number[] {
  const step = centres.length > 0 ? Math.min(spacing, height / centres.length) : spacing;
  const low = step / 2;
  const high = height - step / 2;
  const spread: number[] = [];
  for (const centre of centres) spread.push(Math.max(centre, low, (spread.at(-1) ?? -Infinity) + step));
  for (let i = spread.length - 1; i >= 0; i -= 1) spread[i] = Math.min(spread[i] ?? 0, i === spread.length - 1 ? high : (spread[i + 1] ?? 0) - step);
  return spread;
}

function round(value: number): string {
  return String(Number(value.toFixed(2)));
}
