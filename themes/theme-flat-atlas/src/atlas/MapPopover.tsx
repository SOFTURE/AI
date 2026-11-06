import type { HTMLAttributes, ReactNode } from "react";

import { cn } from "../lib/utils.js";

export interface MapPopoverProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** The place's name, in the display face. */
  readonly place: ReactNode;
  /** Country and dates in words, one entry each, in `muted`. */
  readonly meta?: readonly ReactNode[];
  /** Coordinates in the mono face (`formatCoordinates`). */
  readonly coordinates?: string;
  /** A link to the post, or a list of places for a cluster. */
  readonly children?: ReactNode;
}

/** A pin's popover: 260 px, raised surface, one hairline, the card radius, flat. The app positions it. */
export function MapPopover({ place, meta, coordinates, children, className, ...props }: MapPopoverProps) {
  return (
    <div
      data-slot="map-popover"
      className={cn("grid w-popover max-w-full gap-1.5 rounded-card border border-border bg-surface-raised px-4 py-3.5 text-foreground", className)}
      {...props}
    >
      <p className="m-0 font-display text-place-name">{place}</p>
      {meta === undefined || meta.length === 0 ? null : (
        <p className="m-0 flex flex-wrap gap-2 text-meta text-muted">
          {meta.map((item, index) => (
            // The entries are positional text with no identity of their own.
            <span key={index}>{item}</span>
          ))}
        </p>
      )}
      {coordinates === undefined ? null : <p className="m-0 font-mono text-coord text-muted">{coordinates}</p>}
      {children}
    </div>
  );
}
