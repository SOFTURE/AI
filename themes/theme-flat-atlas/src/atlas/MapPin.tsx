import type { MouseEventHandler, ReactNode } from "react";

import { cn } from "../lib/utils.js";

import type { TravelStatus } from "./status.js";

export interface MapPinTag {
  /** The place's name. */
  readonly name: ReactNode;
  /** A year or a date in words, smaller; never a numeric date. */
  readonly detail?: ReactNode;
}

export interface MapPinProps {
  /** The position from the map's left edge, in percent. */
  readonly x: number;
  /** The position from the map's top edge, in percent. */
  readonly y: number;
  /** The accessible name: place, country, date in words ("Lisbon, Portugal, May 2024"). */
  readonly label: string;
  readonly status?: TravelStatus;
  /** The flag over the pin, shown on hover and focus, or always with `isTagShown`. */
  readonly tag?: MapPinTag;
  readonly isTagShown?: boolean;
  /** Marks the pin whose popover is open (`aria-expanded`). */
  readonly isSelected?: boolean;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
  readonly className?: string;
}

/**
 * A place on the map: a 14 px dot (10 px on a phone) in marigold with a 2 px ink stroke and a white centre, inside a
 * 40 px button. A planned place: the same dot in passport blue, as easy to see as a visited one. Hover and focus grow
 * the dot to 1.25 in 160 ms and show the stamp-ink flag above every other pin; nothing bounces, pulses or glows.
 */
export function MapPin({ x, y, label, status = "visited", tag, isTagShown = false, isSelected, onClick, className }: MapPinProps) {
  const isPlanned = status === "planned";
  return (
    <span
      data-slot="map-pin"
      data-status={status}
      className={cn("absolute size-0 focus-within:z-10 hover:z-10", (isTagShown || isSelected === true) && "z-10", className)} style={{ left: `${String(x)}%`, top: `${String(y)}%` }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={isSelected}
        onClick={onClick}
        className="peer group/pin absolute -top-5 -left-5 flex size-touch cursor-pointer items-center justify-center rounded-pill focus-visible:outline-none"
      >
        <span
          className={cn(
            "flex size-pin-sm items-center justify-center rounded-pill border-2 transition-transform group-hover/pin:scale-125 group-focus-visible/pin:scale-125 group-focus-visible/pin:outline-2 group-focus-visible/pin:outline-offset-2 group-focus-visible/pin:outline-accent md:size-pin",
            isPlanned ? "border-pin-stroke bg-planned" : "border-pin-stroke bg-place",
          )}
        >
          <span className="size-1 rounded-pill bg-paper" />
        </span>
      </button>
      {tag === undefined ? null : (
        <span
          aria-hidden="true"
          data-slot="map-pin-tag"
          className={cn(
            "pointer-events-none absolute -top-3 left-3 inline-flex h-tag items-center gap-1.5 rounded-tag px-2 text-tag whitespace-nowrap transition-opacity peer-hover:opacity-100 peer-focus-visible:opacity-100",
            isTagShown || isSelected === true ? "opacity-100" : "opacity-0",
            isPlanned ? "border border-dashed border-planned bg-surface-raised text-foreground" : "bg-accent-fill text-on-accent",
          )}
        >
          {tag.name}
          {tag.detail === undefined ? null : <small className="text-tag-detail opacity-85">{tag.detail}</small>}
        </span>
      )}
    </span>
  );
}

export interface MapPinClusterProps {
  readonly x: number;
  readonly y: number;
  /** The number of places the cluster stands for. */
  readonly count: number;
  /** The accessible name ("5 places in Europe"). */
  readonly label: string;
  readonly isSelected?: boolean;
  readonly onClick?: MouseEventHandler<HTMLButtonElement>;
  readonly className?: string;
}

/** Dense pins merged on a phone: a 22 px stamp-ink dot with the count; its popover lists the places. */
export function MapPinCluster({ x, y, count, label, isSelected, onClick, className }: MapPinClusterProps) {
  return (
    <span data-slot="map-pin-cluster" className={cn("absolute size-0", className)} style={{ left: `${String(x)}%`, top: `${String(y)}%` }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={isSelected}
        onClick={onClick}
        className="group/pin absolute -top-5 -left-5 flex size-touch cursor-pointer items-center justify-center rounded-pill focus-visible:outline-none"
      >
        <span className="num flex size-pin-cluster items-center justify-center rounded-pill bg-accent-fill text-tag text-on-accent transition-transform group-hover/pin:scale-125 group-focus-visible/pin:scale-125 group-focus-visible/pin:outline-2 group-focus-visible/pin:outline-offset-2 group-focus-visible/pin:outline-accent">
          {count}
        </span>
      </button>
    </span>
  );
}
