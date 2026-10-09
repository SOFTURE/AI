import { type ReactNode, useId } from "react";
import { type ChartTone, cx, seriesColourClass, seriesColourStyle } from "./class-names.js";
import { percent, toPercent } from "./geometry.js";
import { layoutSankey, type SankeyItem, type SankeyLayoutOptions, type SankeyNode } from "./sankey-layout.js";

/** How a node is filled: `solid` in full colour, `tint` lightly, `hatch` lightly with diagonal lines (a planned flow). */
export type SankeyFill = "solid" | "tint" | "hatch";

export interface SankeyEntry extends SankeyItem {
  readonly label: ReactNode;
  /** The formatted value, a second line under the label. */
  readonly valueLabel?: ReactNode;
  /** A series colour (`seriesSlot(index)`); wins over `tone`. */
  readonly slot?: number;
  /** A role colour (`ChartTone`). */
  readonly tone?: ChartTone;
  /** An app colour that is no token (a CSS colour or `var(…)`); wins over `slot` and `tone`. */
  readonly color?: string;
  readonly fill?: SankeyFill;
}

export interface SankeyProps {
  /** Nodes on both sides, each side top to bottom in this order. */
  readonly items: readonly SankeyEntry[];
  /** Node width, gaps and label spacing in viewBox units (`layoutSankey`). */
  readonly layout?: Omit<SankeyLayoutOptions, "width" | "height">;
  readonly className?: string;
}

/**
 * A two-sided Sankey: inputs on the left flow into a hub, the hub flows to the outputs on the right. The drawing
 * stretches to the plot's box like every plot and is hidden from assistive technology, with its labels: pair it with a
 * `ChartDataTable`. Labels are HTML beside the plot, spread apart where nodes are thin.
 */
export function Sankey({ items, layout: options, className }: SankeyProps) {
  const layout = layoutSankey(items, options);
  const patternPrefix = `sft-sankey-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const nodes = [...layout.inputs, ...layout.outputs];
  return (
    <div className={cx("sft-chart-sankey", className)}>
      <SankeyLabels nodes={layout.inputs} height={layout.height} side="in" />
      <div className="sft-chart-plot">
        <svg
          className="sft-chart-svg"
          viewBox={`0 0 ${String(layout.width)} ${String(layout.height)}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            {nodes.map((node, index) =>
              node.item.fill === "hatch" ? (
                <pattern
                  key={node.item.key}
                  id={`${patternPrefix}-${String(index)}`}
                  className={cx("sft-chart-sankey-hatch", seriesColourClass(node.item))}
                  style={seriesColourStyle(node.item.color)}
                  patternUnits="userSpaceOnUse"
                  width={8}
                  height={8}
                  patternTransform="rotate(45)"
                >
                  <line x1={0} y1={0} x2={0} y2={8} />
                </pattern>
              ) : null,
            )}
          </defs>
          {nodes.map((node) => (
            <path
              key={node.item.key}
              className={cx("sft-chart-sankey-link", seriesColourClass(node.item))}
              style={seriesColourStyle(node.item.color)}
              d={node.link}
            />
          ))}
          <rect className="sft-chart-sankey-hub" x={layout.hub.x} y={layout.hub.y} width={layout.hub.width} height={layout.hub.height} />
          {nodes.map((node, index) => (
            <SankeyNodeBar key={node.item.key} node={node} patternId={`${patternPrefix}-${String(index)}`} />
          ))}
        </svg>
      </div>
      <SankeyLabels nodes={layout.outputs} height={layout.height} side="out" />
    </div>
  );
}

function SankeyNodeBar({ node, patternId }: { readonly node: SankeyNode<SankeyEntry>; readonly patternId: string }) {
  const fill = node.item.fill ?? "solid";
  const box = { x: node.x, y: node.y, width: node.width, height: node.height };
  return (
    <>
      <rect
        className={cx("sft-chart-sankey-node", seriesColourClass(node.item), fill !== "solid" && "sft-chart-sankey-tint")}
        style={seriesColourStyle(node.item.color)}
        {...box}
      />
      {fill === "hatch" && <rect className="sft-chart-sankey-hatch-fill" fill={`url(#${patternId})`} {...box} />}
    </>
  );
}

function SankeyLabels({ nodes, height, side }: { readonly nodes: readonly SankeyNode<SankeyEntry>[]; readonly height: number; readonly side: "in" | "out" }) {
  return (
    <div aria-hidden="true" className={cx("sft-chart-sankey-labels", `sft-chart-sankey-labels-${side}`)}>
      {nodes.map((node) => (
        <span key={node.item.key} className="sft-chart-sankey-label" style={{ top: percent(toPercent(node.labelY, height)) }}>
          <span>{node.item.label}</span>
          {node.item.valueLabel !== undefined && <span className="sft-chart-sankey-value">{node.item.valueLabel}</span>}
        </span>
      ))}
    </div>
  );
}
