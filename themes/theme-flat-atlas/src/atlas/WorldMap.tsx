"use client";

import { useState, type MouseEvent, type PointerEvent, type ReactNode } from "react";

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
  /**
   * How a fitted map fills its box: `contain` (the default) shows the whole map; `cover` fills the box's height as well,
   * as wide as twice the height, and scrolls sideways, for a phone where the map is the whole screen.
   */
  readonly fit?: "contain" | "cover";
  /**
   * Country names by the same numeric code, shown as a tag at the mouse pointer while it rests on that country (with
   * the country lifted a shade), on a device with a mouse; touch and pen never show it. A country without a name
   * shows no tag. The names are visual only: the map stays one image with its own label.
   */
  readonly countryLabels?: Readonly<Record<string, string>>;
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
const FITTED_MAP_LOOK: Readonly<Record<NonNullable<WorldMapProps["fit"]>, string>> = {
  contain: "m-auto w-[min(100cqw,200cqh)]",
  cover: "m-auto w-[max(100cqw,200cqh)]",
};

/**
 * The hero world map: Natural Earth 1:110m countries without Antarctica in the Natural Earth II projection, projected
 * at build time into a static 1000 x 500 SVG. Water is one colour, land is flat, a visited country is painted in the
 * stamp ink, a planned one keeps the land with a dashed passport-blue outline. Pins and labels are HTML over the SVG.
 * On a phone the map keeps 720 px and scrolls sideways inside its own container, never the page. `isFitted` makes it
 * fill a box of a given height instead, for a map that is the whole screen; `fit="cover"` also fills its height.
 */
// Planned countries are drawn last: their dashed outline is wider than a neighbour's edge, so a neighbour drawn
// after one would cover half of its border (China under Mongolia, Russia and India).
const PAINT_ORDER: Record<TravelStatus | "land", number> = { land: 0, visited: 1, planned: 2 };

type CountryShape = (typeof WORLD_COUNTRY_SHAPES)[number];

function sortByPaintOrder(countries: WorldMapProps["countries"]): { readonly shape: CountryShape; readonly status: TravelStatus | undefined }[] {
  return WORLD_COUNTRY_SHAPES.map((shape) => ({ shape, status: shape.id === null ? undefined : countries[shape.id] })).sort(
    (a, b) => PAINT_ORDER[a.status ?? "land"] - PAINT_ORDER[b.status ?? "land"],
  );
}

interface HoveredCountry {
  readonly id: string;
  /** The pointer in percent of the map. */
  readonly x: number;
  readonly y: number;
}

/** The country under a mouse pointer, in percent of the map; `null` off a named country or for touch and pen. */
function findHoveredCountry(event: PointerEvent<HTMLDivElement>, labels: Readonly<Record<string, string>>): HoveredCountry | null {
  if (event.pointerType !== "mouse" || !(event.target instanceof Element)) return null;
  const id = event.target.closest("path[data-id]")?.getAttribute("data-id");
  if (id === null || id === undefined || labels[id] === undefined) return null;
  const box = event.currentTarget.getBoundingClientRect();
  if (box.width === 0 || box.height === 0) return null;
  return { id, x: ((event.clientX - box.left) / box.width) * 100, y: ((event.clientY - box.top) / box.height) * 100 };
}

export function WorldMap({ label, countries, places = [], selectedPlaceKey, onPlaceClick, hasGraticule = true, isFitted = false, fit = "contain", countryLabels, children, className }: WorldMapProps) {
  const [hovered, setHovered] = useState<HoveredCountry | null>(null);
  const onPointerMove =
    countryLabels === undefined
      ? undefined
      : (event: PointerEvent<HTMLDivElement>) => {
          const next = findHoveredCountry(event, countryLabels);
          setHovered((current) => (next === null && current === null ? current : next));
        };
  const hoveredLabel = hovered === null ? undefined : countryLabels?.[hovered.id];
  return (
    <div
      data-slot="world-map"
      data-fitted={isFitted ? "" : undefined}
      className={cn("overflow-x-auto overscroll-x-contain", isFitted && FITTED_BOX_LOOK, className)}
    >
      <div
        className={cn("relative min-w-map-min", isFitted && FITTED_MAP_LOOK[fit])}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerMove === undefined ? undefined : () => { setHovered(null); }}
      >
        <svg
          viewBox={`0 0 ${String(WORLD_MAP_VIEWBOX.width)} ${String(WORLD_MAP_VIEWBOX.height)}`}
          role="img"
          aria-label={label}
          className="block h-auto w-full bg-map-ocean"
        >
          {hasGraticule ? <path d={WORLD_GRATICULE_PATH} className="fill-none stroke-foreground/7 stroke-[0.5]" /> : null}
          {sortByPaintOrder(countries).map(({ shape, status }) => {
            return (
              <path
                key={`${shape.id ?? "none"}-${shape.name}`}
                d={shape.d}
                data-id={shape.id ?? undefined}
                data-status={status}
                data-hovered={hovered !== null && shape.id === hovered.id ? "" : undefined}
                className={cn("transition-[filter] [stroke-linejoin:round] data-hovered:brightness-90", COUNTRY_LOOK[status ?? "land"])}
              />
            );
          })}
        </svg>
        {/* The layer lets the pointer through to the countries; its own children (pins, popovers) take it back. */}
        <div className="pointer-events-none absolute inset-0 *:pointer-events-auto">
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
          {hovered === null || hoveredLabel === undefined ? null : (
            <span
              aria-hidden="true"
              data-slot="world-map-country-tag"
              className="pointer-events-none! absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-tag bg-foreground px-2.5 py-1 text-label whitespace-nowrap text-background"
              style={{ left: `${String(hovered.x)}%`, top: `${String(hovered.y)}%` }}
            >
              {hoveredLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
