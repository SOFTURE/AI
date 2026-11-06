import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";

/** What a legend entry stands for: a painted country, a place pin, a planned country, land not yet visited. */
export type MapLegendKind = "visited" | "place" | "planned" | "land";

export interface MapLegendItem {
  readonly kind: MapLegendKind;
  readonly label: ReactNode;
}

export interface MapLegendProps {
  readonly items: readonly MapLegendItem[];
  readonly className?: string;
}

const SWATCH_LOOK: Readonly<Record<MapLegendKind, string>> = {
  visited: "h-2.5 w-3.5 rounded-swatch bg-visited",
  place: "size-3 rounded-pill border-2 border-pin-stroke bg-place",
  planned: "h-2.5 w-3.5 rounded-swatch border border-dashed border-planned",
  land: "h-2.5 w-3.5 rounded-swatch bg-map-land",
};

/** The map's key, as HTML under the map: one swatch per meaning, each with its second carrier. */
export function MapLegend({ items, className }: MapLegendProps) {
  return (
    <ul data-slot="map-legend" className={cn("m-0 flex list-none flex-wrap gap-x-4.5 gap-y-2 p-0 text-meta text-muted", className)}>
      {items.map((item) => (
        <li key={item.kind} className="inline-flex items-center gap-2">
          <i aria-hidden="true" className={SWATCH_LOOK[item.kind]} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
