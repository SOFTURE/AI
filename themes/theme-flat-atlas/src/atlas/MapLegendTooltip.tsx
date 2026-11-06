"use client";

import { useId, type ReactNode } from "react";

import { cn } from "../lib/utils.js";

import { Button } from "./Button.js";
import { MapLegend, type MapLegendItem } from "./MapLegend.js";

export interface MapLegendTooltipProps {
  /** The button's text, e.g. "Legend". */
  readonly label: string;
  readonly items: readonly MapLegendItem[];
  /** A line under the legend, such as the map's source. */
  readonly note?: ReactNode;
  readonly className?: string;
}

/**
 * The legend folded into one small button over the map: hover or focus shows the key as a tooltip above it, so a map
 * that fills the screen keeps its edge free. The button describes itself by the tooltip, so a screen reader hears the
 * key on focus.
 */
export function MapLegendTooltip({ label, items, note, className }: MapLegendTooltipProps) {
  const tooltipId = useId();
  return (
    <div data-slot="map-legend-tooltip" className={cn("group relative inline-flex", className)}>
      <Button size="sm" variant="secondary" aria-describedby={tooltipId} className="bg-surface-raised">
        {label}
      </Button>
      <div
        role="tooltip"
        id={tooltipId}
        className="invisible absolute right-0 bottom-full z-20 mb-2 grid w-max gap-3 rounded-card border border-border bg-surface-raised px-4 py-3 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100"
      >
        <MapLegend items={items} className="flex-col" />
        {note === undefined ? null : <span className="font-mono text-coord text-muted">{note}</span>}
      </div>
    </div>
  );
}
