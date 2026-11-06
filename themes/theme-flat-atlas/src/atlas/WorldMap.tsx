import type { MouseEvent, ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { projectToMapPercent } from "../map/map-position.js";
import { WORLD_COUNTRY_SHAPES, WORLD_GRATICULE_PATH, WORLD_MAP_VIEWBOX } from "../map/world-110m.js";

import { MapPin, type MapPinTag } from "./MapPin.js";
import type { TravelStatus } from "./status.js";

export interface WorldMapPlace {
  /** Unique among the places; handed back by `onPlaceClick`. */
  readonly key: string;
  readonly longitude: number;
  readonly latitude: number;
  readonly status: TravelStatus;
  /** The pin's accessible name: place, country, date in words. */
  readonly label: string;
  readonly tag?: MapPinTag;
}

export interface WorldMapProps {
  /** The map's accessible name; the list of countries as text stands beside the map. */
  readonly label: string;
  /** Country status by ISO 3166-1 numeric code as world-atlas writes it (`"616"` for Poland). */
  readonly countries: Readonly<Record<string, TravelStatus>>;
  /** Places as pins, in the order Tab should visit them (chronological). */
  readonly places?: readonly WorldMapPlace[];
  /** The place whose popover is open. */
  readonly selectedPlaceKey?: string;
  readonly onPlaceClick?: (key: string, event: MouseEvent<HTMLButtonElement>) => void;
  /** Draws the 10 degree graticule; on by default. */
  readonly hasGraticule?: boolean;
  /**
   * Fills its box instead of setting its own height: the map stands in the middle, as large as the whole 2:1 map fits
   * (never below the phone minimum, past which it scrolls). The box needs a height of its own, e.g. the screen under
   * the header.
   */
  readonly isFitted?: boolean;
  /** Overlay content positioned in percent of the map, such as the open popover. */
  readonly children?: ReactNode;
  readonly className?: string;
}

const COUNTRY_LOOK: Readonly<Record<TravelStatus | "land", string>> = {
  land: "fill-map-land stroke-map-edge stroke-[0.6]",
  visited: "fill-visited stroke-map-edge stroke-[0.6]",
  planned: "fill-map-land stroke-planned stroke-[1.1] [stroke-dasharray:3_2]",
};

/**
 * A fitted map's box is a size container, so the map can take the smaller of its width and twice its height. Auto
 * margins centre the map and drop to zero once it is wider than the box, so it still scrolls from its own corner.
 */
const FITTED_BOX_LOOK = "grid h-full [container-type:size]";
const FITTED_MAP_LOOK = "m-auto w-[min(100cqw,200cqh)]";

/**
 * The hero world map: Natural Earth 1:110m countries without Antarctica in the Natural Earth II projection, projected
 * at build time into a static 1000 x 500 SVG. Water is one colour, land is flat, a visited country is painted in the
 * stamp ink, a planned one keeps the land with a dashed passport-blue outline. Pins and labels are HTML over the SVG.
 * On a phone the map keeps 720 px and scrolls sideways inside its own container, never the page. `isFitted` makes it
 * fill a box of a given height instead, for a map that is the whole screen.
 */
export function WorldMap({ label, countries, places = [], selectedPlaceKey, onPlaceClick, hasGraticule = true, isFitted = false, children, className }: WorldMapProps) {
  return (
    <div
      data-slot="world-map"
      data-fitted={isFitted ? "" : undefined}
      className={cn("overflow-x-auto overscroll-x-contain", isFitted && FITTED_BOX_LOOK, className)}
    >
      <div className={cn("relative min-w-map-min", isFitted && FITTED_MAP_LOOK)}>
        <svg
          viewBox={`0 0 ${String(WORLD_MAP_VIEWBOX.width)} ${String(WORLD_MAP_VIEWBOX.height)}`}
          role="img"
          aria-label={label}
          className="block h-auto w-full bg-map-ocean"
        >
          {hasGraticule ? <path d={WORLD_GRATICULE_PATH} className="fill-none stroke-foreground/7 stroke-[0.5]" /> : null}
          {WORLD_COUNTRY_SHAPES.map((shape) => {
            const status = shape.id === null ? undefined : countries[shape.id];
            return (
              <path
                key={`${shape.id ?? "none"}-${shape.name}`}
                d={shape.d}
                data-id={shape.id ?? undefined}
                data-status={status}
                className={cn("[stroke-linejoin:round]", COUNTRY_LOOK[status ?? "land"])}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0">
          {places.map((place) => {
            const position = projectToMapPercent(place.longitude, place.latitude);
            return (
              <MapPin
                key={place.key}
                x={position.x}
                y={position.y}
                label={place.label}
                status={place.status}
                tag={place.tag}
                isSelected={selectedPlaceKey === undefined ? undefined : selectedPlaceKey === place.key}
                onClick={onPlaceClick === undefined ? undefined : (event) => { onPlaceClick(place.key, event); }}
              />
            );
          })}
          {children}
        </div>
      </div>
    </div>
  );
}
