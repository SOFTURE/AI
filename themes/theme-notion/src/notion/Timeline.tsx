import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import type { PaletteColor } from "./palette.js";

// `default`: a major entry; `compact`: a minor entry between two major ones.
export type TimelineSize = "default" | "compact";

// `dashed`: something is missing through this entry (a gap).
export type TimelineLine = "solid" | "dashed";

/** The body as a button with its accessible name, or plain text. */
export type TimelineSelectProps =
  | {
      readonly onSelect: () => void;
      /** The button's accessible name. */
      readonly actionLabel: string;
    }
  | {
      readonly onSelect?: never;
      readonly actionLabel?: never;
    };

export type TimelineItem = TimelineSelectProps & {
  /** React's key for the entry. */
  readonly key: string;
  readonly title: ReactNode;
  /** A muted line above the title, in tabular figures. */
  readonly time?: ReactNode;
  readonly description?: ReactNode;
  /** A wrapping row under the description: statuses, tags. */
  readonly badges?: ReactNode;
  /** Drawn at the entry's right edge, outside the body's button, so marks with their own buttons never nest. */
  readonly aside?: ReactNode;
  /** Drawn under the body, outside its button: deadlines, notes. */
  readonly children?: ReactNode;
  /** Defaults to `default`. */
  readonly size?: TimelineSize;
  /** The marker's palette colour, defaults to `gray`. It never stands alone: the entry's words carry the meaning. */
  readonly color?: PaletteColor;
  /** A line icon in the marker; a compact entry without one shows a dot. */
  readonly icon?: LucideIcon;
  /** The rail through this entry; defaults to `solid`. */
  readonly line?: TimelineLine;
  /** Passed to the entry, for an app's hooks and tests. */
  readonly data?: Readonly<Record<`data-${string}`, string | undefined>>;
};

export interface TimelineProps {
  // The list's accessible name.
  readonly label: string;
  readonly items: readonly TimelineItem[];
}

// Literal class names per colour and size, so Tailwind generates each one (the theme's `@source` covers this folder).

// A major entry's marker: the colour's tag fill.
const MARKER_FILL: Readonly<Record<PaletteColor, string>> = {
  gray: "bg-gray-tag text-gray-tag-foreground",
  brown: "bg-brown-tag text-brown-tag-foreground",
  orange: "bg-orange-tag text-orange-tag-foreground",
  yellow: "bg-yellow-tag text-yellow-tag-foreground",
  green: "bg-green-tag text-green-tag-foreground",
  blue: "bg-blue-tag text-blue-tag-foreground",
  purple: "bg-purple-tag text-purple-tag-foreground",
  pink: "bg-pink-tag text-pink-tag-foreground",
  red: "bg-red-tag text-red-tag-foreground",
};

// A minor entry's icon, in the colour on the page background.
const MARKER_TEXT: Readonly<Record<PaletteColor, string>> = {
  gray: "text-gray",
  brown: "text-brown",
  orange: "text-orange",
  yellow: "text-yellow",
  green: "text-green",
  blue: "text-blue",
  purple: "text-purple",
  pink: "text-pink",
  red: "text-red",
};

// A minor entry's dot.
const MARKER_DOT: Readonly<Record<PaletteColor, string>> = {
  gray: "bg-gray",
  brown: "bg-brown",
  orange: "bg-orange",
  yellow: "bg-yellow",
  green: "bg-green",
  blue: "bg-blue",
  purple: "bg-purple",
  pink: "bg-pink",
  red: "bg-red",
};

// The marker column: 24 px wide for every size, so the rail runs straight; the box is as tall as the first line.
const MARKER_BOX: Readonly<Record<TimelineSize, string>> = {
  default: "relative mt-1 flex size-6 shrink-0 items-center justify-center",
  compact: "relative mt-0.5 flex h-5 w-6 shrink-0 items-center justify-center",
};

// The rail starts at the first marker's centre and ends at the last one's (the marker box's top margin plus half its
// height).
const RAIL_FROM_CENTRE: Readonly<Record<TimelineSize, string>> = {
  default: "top-4",
  compact: "top-3",
};

const RAIL_TO_CENTRE: Readonly<Record<TimelineSize, string>> = {
  default: "h-4",
  compact: "h-3",
};

const RAIL_LINE: Readonly<Record<TimelineLine, string>> = {
  solid: "border-solid",
  dashed: "border-dashed",
};

const BODY: Readonly<Record<TimelineSize, string>> = {
  default: "flex w-full min-w-0 flex-col items-start gap-0.5 rounded-md px-2 py-1 text-left",
  compact: "flex w-full min-w-0 flex-col items-start gap-0 rounded-md px-2 py-0.5 text-left",
};

const BODY_BUTTON =
  "cursor-pointer transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

const TITLE: Readonly<Record<TimelineSize, string>> = {
  default: "text-ui-medium",
  compact: "text-small",
};

const ITEM: Readonly<Record<TimelineSize, string>> = {
  default: "relative flex min-w-0 items-start gap-1 pb-2 last:pb-0",
  compact: "relative flex min-w-0 items-start gap-1 pb-1 last:pb-0",
};

// The rail through one entry: from its top (or its marker, for the first) to its bottom (or its marker, for the
// last). A single entry has none.
function getRailClass({ size, line, index, count }: { size: TimelineSize; line: TimelineLine; index: number; count: number }): string | null {
  if (count < 2) return null;
  const isFirst = index === 0;
  const isLast = index === count - 1;
  return cn(
    "absolute left-3 w-0 -translate-x-1/2 border-l border-accent-strong",
    RAIL_LINE[line],
    isFirst ? RAIL_FROM_CENTRE[size] : "top-0",
    isLast ? RAIL_TO_CENTRE[size] : "bottom-0",
  );
}

function TimelineMarker({ size, color, icon: Icon }: { size: TimelineSize; color: PaletteColor; icon?: LucideIcon }) {
  if (size === "default") {
    return (
      <span aria-hidden="true" data-slot="timeline-marker" className={MARKER_BOX.default}>
        <span className={cn("flex size-6 items-center justify-center rounded-full", MARKER_FILL[color])}>
          {Icon === undefined ? null : <Icon strokeWidth={ICON_STROKE_WIDTH} className="size-3.5" />}
        </span>
      </span>
    );
  }
  return (
    <span aria-hidden="true" data-slot="timeline-marker" className={MARKER_BOX.compact}>
      {Icon === undefined ? (
        <span className="flex size-4 items-center justify-center rounded-full bg-background">
          <span className={cn("size-2 rounded-full", MARKER_DOT[color])} />
        </span>
      ) : (
        <span className="flex size-5 items-center justify-center rounded-full bg-background">
          <Icon strokeWidth={ICON_STROKE_WIDTH} className={cn("size-4", MARKER_TEXT[color])} />
        </span>
      )}
    </span>
  );
}

function TimelineBody({ item, size }: { item: TimelineItem; size: TimelineSize }) {
  const content = (
    <>
      {item.time === undefined ? null : (
        <span data-slot="timeline-time" className="text-small text-muted-foreground tabular-nums">
          {item.time}
        </span>
      )}
      <span data-slot="timeline-title" className={TITLE[size]}>
        {item.title}
      </span>
      {item.description === undefined ? null : (
        <span data-slot="timeline-description" className="text-small text-muted-foreground">
          {item.description}
        </span>
      )}
      {item.badges === undefined ? null : (
        <span data-slot="timeline-badges" className="mt-0.5 flex flex-wrap gap-1">
          {item.badges}
        </span>
      )}
    </>
  );
  if (item.onSelect === undefined) {
    return (
      <div data-slot="timeline-body" className={BODY[size]}>
        {content}
      </div>
    );
  }
  return (
    <button
      type="button"
      data-slot="timeline-body"
      aria-label={item.actionLabel}
      onClick={item.onSelect}
      className={cn(BODY[size], BODY_BUTTON)}
    >
      {content}
    </button>
  );
}

// A vertical rail of entries in time: each entry's marker sits on one continuous line that runs from the first
// marker to the last, then its time, title, description and badges, content under them and an aside at the right
// edge. A compact entry is a minor step between two major ones; a dashed rail marks a gap. The marker's colour
// never stands alone: the entry's words carry the meaning, and the marker is hidden from assistive technology.
export function Timeline({ label, items }: TimelineProps) {
  return (
    <ol aria-label={label} data-slot="timeline" className="flex flex-col">
      {items.map((item, index) => {
        const size = item.size ?? "default";
        const color = item.color ?? "gray";
        const line = item.line ?? "solid";
        const railClass = getRailClass({ size, line, index, count: items.length });
        return (
          <li
            key={item.key}
            {...item.data}
            data-slot="timeline-item"
            data-size={size}
            data-color={color}
            data-line={line}
            className={ITEM[size]}
          >
            {railClass === null ? null : <span aria-hidden="true" data-slot="timeline-rail" className={railClass} />}
            <TimelineMarker size={size} color={color} icon={item.icon} />
            <div className="flex min-w-0 flex-1 flex-col">
              <TimelineBody item={item} size={size} />
              {item.children === undefined ? null : (
                <div data-slot="timeline-content" className="px-2 pt-1 text-small">
                  {item.children}
                </div>
              )}
            </div>
            {item.aside === undefined ? null : (
              <div data-slot="timeline-aside" className="flex shrink-0 items-center gap-1 pt-1">
                {item.aside}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
