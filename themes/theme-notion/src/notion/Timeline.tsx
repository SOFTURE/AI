import { ChevronRight, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";
import type { PaletteColor } from "./palette.js";


// `default`: a major entry with a filled round marker; `compact`: a minor entry between two major ones.
export type TimelineItemSize = "default" | "compact";

// The rail through an entry: `dashed` for something missing (a gap).
export type TimelineLine = "solid" | "dashed";

export interface TimelineItemFold {
  // The open state when the app keeps it; left out, the entry keeps its own.
  readonly isOpen?: boolean;
  // Whether an entry that keeps its own state starts open; closed by default.
  readonly isOpenInitially?: boolean;
  readonly onOpenChange?: (isOpen: boolean) => void;
}

interface TimelineItemBase {
  // Unique within the timeline; kept on the item as `data-item`.
  readonly key: string;
  readonly title: ReactNode;
  // When it happens, drawn above the title (`default`) or after it (`compact`) in muted tabular figures.
  readonly time?: ReactNode;
  // A muted line under the title: a route, a place.
  readonly description?: ReactNode;
  // Statuses and tags in a wrapping row under the description.
  readonly badges?: ReactNode;
  // Drawn at the item's right edge, outside its button: marks that open their own popovers.
  readonly aside?: ReactNode;
  // More content under the body: deadlines, notes.
  readonly children?: ReactNode;
  // A Lucide icon inside the marker; without it a `default` marker is a filled circle, a `compact` one a dot.
  readonly icon?: LucideIcon;
  // The marker's palette colour, `gray` by default; the entry's words carry the meaning, never the colour alone.
  readonly color?: PaletteColor;
  readonly size?: TimelineItemSize;
  readonly line?: TimelineLine;
  // Read before the body button's visible text ("Show on the map"), so the button's name starts with what it does and
  // still contains every word it shows.
  readonly actionLabel?: string;
  // `data-*` attributes set on the item, for an app's own hooks.
  readonly data?: Readonly<Record<`data-${string}`, string | undefined>>;
}

// What the body does: nothing, call `onSelect` as a button, or fold `children` open and closed as a disclosure button
// (`aria-expanded`), at least the touch target high.
export type TimelineItem = TimelineItemBase &
  (
    | { readonly onSelect?: () => void; readonly fold?: never }
    | { readonly fold: TimelineItemFold; readonly onSelect?: never }
  );

export interface TimelineProps {
  // The list's accessible name.
  readonly label: string;
  readonly items: readonly TimelineItem[];
  readonly className?: string;
}

// Literal class names per palette colour, so Tailwind generates each one (the theme's `@source` covers this folder).
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

// The marker column is 24 px wide; the rail runs down its middle, from the first marker to the last.
const ITEM_CLASS = "group/timeline-item relative grid grid-cols-[1.5rem_minmax(0,1fr)_auto] gap-x-1";
const RAIL_CLASS =
  "absolute top-0 bottom-0 left-3 -translate-x-1/2 border-l-2 border-border group-first/timeline-item:top-4 group-last/timeline-item:bottom-auto group-last/timeline-item:h-4 group-only/timeline-item:hidden";
const RAIL_LINE: Readonly<Record<TimelineLine, string>> = {
  solid: "border-solid",
  dashed: "border-dashed",
};

const MARKER_CLASS: Readonly<Record<TimelineItemSize, string>> = {
  default: "relative mt-1 flex size-6 items-center justify-center justify-self-center rounded-full [&>svg]:size-3.5",
  compact: "relative mt-1.5 flex size-5 items-center justify-center justify-self-center rounded-full bg-background [&>svg]:size-3.5",
};

const BODY_CLASS: Readonly<Record<TimelineItemSize, string>> = {
  default: "flex min-w-0 flex-col gap-0.5 rounded-md px-2 py-1 text-start",
  compact: "flex min-w-0 flex-col rounded-md px-2 py-1 text-start",
};
const BUTTON_CLASS =
  "cursor-pointer text-foreground transition-colors duration-120 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none";

// A folding body is at least the touch target high and leaves room for the chevron at its right edge.
const FOLD_BODY_CLASS = "group/timeline-fold relative min-h-touch-target pr-7";
const FOLD_CHEVRON_CLASS =
  "absolute top-2 right-1.5 size-4 text-muted-foreground transition-transform duration-150 group-data-[state=open]/timeline-fold:rotate-90";

const ITEM_PADDING: Readonly<Record<TimelineItemSize, string>> = {
  default: "pb-2",
  compact: "pb-1",
};

// A dated sequence on a vertical rail: each entry a marker in a palette colour, its time, title, description and
// badges, minor entries (`compact`) between major ones, a dashed rail where something is missing, and marks at the
// right edge outside the entry's button.
export function Timeline({ label, items, className }: TimelineProps) {
  return (
    <ol aria-label={label} data-slot="timeline" className={cn("flex flex-col", className)}>
      {items.map((item) => (
        <TimelineEntry key={item.key} item={item} />
      ))}
    </ol>
  );
}

function TimelineEntry({ item }: { readonly item: TimelineItem }) {
  const size = item.size ?? "default";
  const line = item.line ?? "solid";
  const color = item.color ?? "gray";
  return (
    <li {...item.data} data-slot="timeline-item" data-item={item.key} data-size={size} data-line={line} className={cn(ITEM_CLASS, ITEM_PADDING[size])}>
      <span aria-hidden="true" data-slot="timeline-rail" className={cn(RAIL_CLASS, RAIL_LINE[line])} />
      <TimelineMarker icon={item.icon} color={color} size={size} />
      <div className={cn("flex min-w-0 flex-col", item.aside === undefined && "col-span-2")}>
        {item.fold === undefined ? (
          <>
            <TimelineBody item={item} size={size} />
            {item.children === undefined ? null : (
              <div data-slot="timeline-item-content" className="px-2 pb-1">
                {item.children}
              </div>
            )}
          </>
        ) : (
          <TimelineFold item={item} fold={item.fold} size={size} />
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

function TimelineMarker({ icon: Icon, color, size }: { readonly icon?: LucideIcon; readonly color: PaletteColor; readonly size: TimelineItemSize }) {
  const look = size === "default" ? MARKER_FILL[color] : MARKER_TEXT[color];
  return (
    <span aria-hidden="true" data-slot="timeline-marker" data-color={color} className={cn(MARKER_CLASS[size], look)}>
      {Icon === undefined ? (
        <span className={cn("rounded-full", size === "default" ? "size-2 bg-current" : cn("size-2", MARKER_DOT[color]))} />
      ) : (
        <Icon strokeWidth={ICON_STROKE_WIDTH} />
      )}
    </span>
  );
}

function TimelineBodyContent({ item, size }: { readonly item: TimelineItem; readonly size: TimelineItemSize }) {
  const time =
    item.time === undefined ? null : (
      <span data-slot="timeline-item-time" className="text-small text-muted-foreground tabular-nums">
        {item.time}
      </span>
    );
  const description =
    item.description === undefined ? null : (
      <span data-slot="timeline-item-description" className="text-small text-muted-foreground [overflow-wrap:anywhere]">
        {item.description}
      </span>
    );
  const badges =
    item.badges === undefined ? null : (
      <span data-slot="timeline-item-badges" className={cn("flex flex-wrap items-center gap-x-3 gap-y-1", size === "default" && "mt-0.5")}>
        {item.badges}
      </span>
    );
  return (
    <>
      {size === "default" ? (
        <>
          {time}
          <span data-slot="timeline-item-title" className="text-ui-medium [overflow-wrap:anywhere]">
            {item.title}
          </span>
        </>
      ) : (
        <span className="flex flex-wrap items-baseline gap-x-2">
          <span data-slot="timeline-item-title" className="text-ui-medium [overflow-wrap:anywhere]">
            {item.title}
          </span>
          {time}
        </span>
      )}
      {size === "default" ? (
        <>
          {description}
          {badges}
        </>
      ) : description === null || badges === null ? (
        (description ?? badges)
      ) : (
        // A minor entry keeps its route and its status on one wrapping line.
        <span className="flex flex-wrap items-center gap-x-3">
          {description}
          {badges}
        </span>
      )}
    </>
  );
}

function TimelineBody({ item, size }: { readonly item: TimelineItem; readonly size: TimelineItemSize }) {
  const content = <TimelineBodyContent item={item} size={size} />;
  if (item.onSelect === undefined) {
    return (
      <div data-slot="timeline-item-body" className={BODY_CLASS[size]}>
        {content}
      </div>
    );
  }
  return (
    <button type="button" data-slot="timeline-item-body" className={cn(BODY_CLASS[size], BUTTON_CLASS)} onClick={item.onSelect}>
      {item.actionLabel === undefined ? null : <span className="sr-only">{`${item.actionLabel}: `}</span>}
      {content}
    </button>
  );
}

// The body as a disclosure button (`aria-expanded`, `aria-controls`) that folds the entry's content open and closed.
function TimelineFold({ item, fold, size }: { readonly item: TimelineItem; readonly fold: TimelineItemFold; readonly size: TimelineItemSize }) {
  return (
    <Collapsible
      {...(fold.isOpen === undefined ? {} : { open: fold.isOpen })}
      defaultOpen={fold.isOpenInitially ?? false}
      {...(fold.onOpenChange === undefined ? {} : { onOpenChange: fold.onOpenChange })}
      className="flex min-w-0 flex-col"
    >
      <CollapsibleTrigger data-slot="timeline-item-body" className={cn(BODY_CLASS[size], BUTTON_CLASS, FOLD_BODY_CLASS)}>
        {item.actionLabel === undefined ? null : <span className="sr-only">{`${item.actionLabel}: `}</span>}
        <TimelineBodyContent item={item} size={size} />
        <ChevronRight aria-hidden="true" strokeWidth={ICON_STROKE_WIDTH} className={FOLD_CHEVRON_CLASS} />
      </CollapsibleTrigger>
      <CollapsibleContent data-slot="timeline-item-content" className="px-2 pb-1">
        {item.children}
      </CollapsibleContent>
    </Collapsible>
  );
}
