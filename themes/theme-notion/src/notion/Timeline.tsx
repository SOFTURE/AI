import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import type { PaletteColor } from "./palette.js";

// `default`: a major entry; `compact`: a minor entry between two major ones (a move between two stays).
export type TimelineSize = "default" | "compact";

// `dashed`: something is missing through this entry (a gap).
export type TimelineLine = "solid" | "dashed";

/** The body as a button, or plain text. */
export type TimelineSelectProps =
  | {
      readonly onSelect: () => void;
      /**
       * What the button does ("Show on the map"): read before the entry's visible words, for a screen reader only, so
       * the button's name always contains what a speech-input user sees (WCAG 2.5.3).
       */
      readonly actionLabel: string;
    }
  | {
      readonly onSelect?: never;
      readonly actionLabel?: never;
    };

export type TimelineItem = TimelineSelectProps & {
  /** Unique within the list; kept on the entry as `data-item`. */
  readonly key: string;
  readonly title: ReactNode;
  /** Muted, in tabular figures: above the title of a default entry, beside the title of a compact one. */
  readonly time?: ReactNode;
  readonly description?: ReactNode;
  /** A wrapping row under the description: statuses and tags, inside the body's button when there is one. */
  readonly badges?: ReactNode;
  /** Drawn at the entry's right edge, outside the body's button, so marks with their own buttons never nest. */
  readonly aside?: ReactNode;
  /** Drawn under the body, outside its button: deadlines, notes. */
  readonly children?: ReactNode;
  /** A line icon in the marker; without one the marker shows a dot. */
  readonly icon?: LucideIcon;
  /** The marker's palette colour, defaults to `gray`. It never stands alone: the entry's words carry the meaning. */
  readonly color?: PaletteColor;
  /** Defaults to `default`. */
  readonly size?: TimelineSize;
  /** The rail through this entry; defaults to `solid`. */
  readonly line?: TimelineLine;
  /** Passed to the entry, for an app's hooks and tests; the entry's own attributes win. */
  readonly data?: Readonly<Record<`data-${string}`, string | undefined>>;
};

export interface TimelineProps {
  // The list's accessible name.
  readonly label: string;
  readonly items: readonly TimelineItem[];
  readonly className?: string;
}

// Literal class names per colour and size, so Tailwind generates each one (the theme's `@source` covers this folder).

// A default marker: the colour's tag fill.
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

// A compact marker: the icon in the colour, on the page background.
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

// A compact marker without an icon: a dot in the colour.
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

// Three columns: the 24 px marker column the rail runs through, the body, the aside.
const ITEM = "group/timeline-item relative grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-1";

const ITEM_SPACING: Readonly<Record<TimelineSize, string>> = {
  default: "pb-2",
  compact: "pb-1",
};

// The rail through one entry, top to bottom; the first starts and the last ends at its marker's centre (16 px down for
// both sizes), a single entry has none.
const RAIL =
  "absolute top-0 bottom-0 left-3 -translate-x-1/2 border-l-2 border-border group-first/timeline-item:top-4 group-last/timeline-item:bottom-auto group-last/timeline-item:h-4 group-only/timeline-item:hidden";

const RAIL_LINE: Readonly<Record<TimelineLine, string>> = {
  solid: "border-solid",
  dashed: "border-dashed",
};

// Opaque (the tag fill, or the page background), so the rail never crosses a marker.
const MARKER: Readonly<Record<TimelineSize, string>> = {
  default: "relative mt-1 flex size-6 items-center justify-center justify-self-center rounded-full [&>svg]:size-3.5",
  compact:
    "relative mt-1.5 flex size-5 items-center justify-center justify-self-center rounded-full bg-background [&>svg]:size-3.5",
};

const BODY: Readonly<Record<TimelineSize, string>> = {
  default: "flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1 text-start",
  compact: "flex min-w-0 flex-col rounded-md px-2 py-1 text-start",
};

const BODY_BUTTON =
  "cursor-pointer text-foreground transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

function TimelineMarker({ icon: Icon, color, size }: { icon?: LucideIcon; color: PaletteColor; size: TimelineSize }) {
  const colorClass = size === "default" ? MARKER_FILL[color] : MARKER_TEXT[color];
  const dotClass = size === "default" ? "size-2 bg-current" : cn("size-2", MARKER_DOT[color]);
  return (
    <span aria-hidden="true" data-slot="timeline-marker" data-color={color} className={cn(MARKER[size], colorClass)}>
      {Icon === undefined ? <span className={cn("rounded-full", dotClass)} /> : <Icon strokeWidth={ICON_STROKE_WIDTH} />}
    </span>
  );
}

function TimelineBody({ item, size }: { item: TimelineItem; size: TimelineSize }) {
  const time =
    item.time === undefined ? null : (
      <span data-slot="timeline-item-time" className="text-small text-muted-foreground tabular-nums">
        {item.time}
      </span>
    );
  const title = (
    <span data-slot="timeline-item-title" className="text-ui-medium [overflow-wrap:anywhere]">
      {item.title}
    </span>
  );
  const content = (
    <>
      {size === "default" ? (
        <>
          {time}
          {title}
        </>
      ) : (
        <span className="flex flex-wrap items-baseline gap-x-2">
          {title}
          {time}
        </span>
      )}
      {item.description === undefined ? null : (
        <span data-slot="timeline-item-description" className="text-small text-muted-foreground [overflow-wrap:anywhere]">
          {item.description}
        </span>
      )}
      {item.badges === undefined ? null : (
        <span data-slot="timeline-item-badges" className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
          {item.badges}
        </span>
      )}
    </>
  );
  if (item.onSelect === undefined) {
    return (
      <div data-slot="timeline-item-body" className={BODY[size]}>
        {content}
      </div>
    );
  }
  return (
    <button type="button" data-slot="timeline-item-body" className={cn(BODY[size], BODY_BUTTON)} onClick={item.onSelect}>
      <span className="sr-only">{`${item.actionLabel}: `}</span>
      {content}
    </button>
  );
}

function TimelineEntry({ item }: { item: TimelineItem }) {
  const size = item.size ?? "default";
  const line = item.line ?? "solid";
  const color = item.color ?? "gray";
  return (
    <li
      {...item.data}
      data-slot="timeline-item"
      data-item={item.key}
      data-size={size}
      data-line={line}
      className={cn(ITEM, ITEM_SPACING[size])}
    >
      <span aria-hidden="true" data-slot="timeline-rail" className={cn(RAIL, RAIL_LINE[line])} />
      <TimelineMarker icon={item.icon} color={color} size={size} />
      <div className={cn("flex min-w-0 flex-col", item.aside === undefined && "col-span-2")}>
        <TimelineBody item={item} size={size} />
        {item.children === undefined ? null : (
          <div data-slot="timeline-item-content" className="px-2 pb-1">
            {item.children}
          </div>
        )}
      </div>
      {item.aside === undefined ? null : (
        <div data-slot="timeline-item-aside" className="flex shrink-0 items-start gap-1 pt-1">
          {item.aside}
        </div>
      )}
    </li>
  );
}

// Entries in time on one vertical rail that runs from the first marker to the last: each entry's marker, then its
// time, title, description and badges, content under them and an aside at the right edge. A compact entry is a minor
// one between two major ones; a dashed rail marks a gap. The marker's colour never stands alone: the entry's words
// carry the meaning, and the marker and the rail are hidden from assistive technology. No hooks: without `onSelect`
// it renders on the server.
export function Timeline({ label, items, className }: TimelineProps) {
  return (
    <ol aria-label={label} data-slot="timeline" className={cn("flex flex-col", className)}>
      {items.map((item) => (
        <TimelineEntry key={item.key} item={item} />
      ))}
    </ol>
  );
}
