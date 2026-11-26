import type { Density } from "@softure-ai/theme-kit";
import { ChevronRight } from "lucide-react";
import { Slot } from "radix-ui";
import type { ComponentProps, ElementType, ReactNode } from "react";

import { cn } from "../lib/utils.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

/**
 * The classes of a list that follows the density (`data-density` on the list or an ancestor; theme-kit's
 * `--list-*` variables). For a list the app renders itself, such as a `SortableList` and its `SortableItem`s.
 * - `list`: the line between rows only, in the theme's `border`, as wide as the density says (none when compact).
 * - `tintedList`: the same on a tinted card (`secondary`, `muted`), where the line takes the page's `background`: in the
 *   dark scheme `border` is the card's own grey.
 * - `item`: the room between a row and the lines around it, so a row's rounded hover never touches a line.
 * - `row`: a row's padding and hover, for a button or link that fills its item.
 * - `group`: a run of lists under a sticky heading, with the side room the heading bleeds over; every item in it stops
 *   below the heading when scrolled into view.
 * - `groupHeading` / `tintedGroupHeading`: the heading that sticks at the top of the scroll container, on the page's
 *   `background` or on a tinted card's `secondary`, with the list's line under it.
 */
export const LIST_CLASSES = {
  list: "flex flex-col divide-y-(length:--list-divider-width) divide-border",
  tintedList: "flex flex-col divide-y-(length:--list-divider-width) divide-background",
  item: "py-(--list-item-y)",
  row: "flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-(--list-row-y) text-start text-ui outline-none transition-colors duration-100 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  group: "px-2 **:data-[slot=list-item]:scroll-mt-10",
  groupHeading:
    "sticky top-0 z-10 -mx-2 flex min-h-10 items-center border-b border-border bg-background px-4 py-2 text-ui-medium text-foreground",
  tintedGroupHeading:
    "sticky top-0 z-10 -mx-2 flex min-h-10 items-center border-b border-background bg-secondary px-4 py-2 text-ui-medium text-foreground",
} as const;

export type ListSurface = "page" | "tinted";

export type ListProps = Omit<ComponentProps<"ul">, "ref"> & {
  /** The list element: `ol` for a numbered list. */
  readonly as?: "ul" | "ol";
  /** `tinted` on a grey card: the line between rows takes the page's `background`. */
  readonly surface?: ListSurface;
  /** Sets the density on this list (its `data-density`); without it the list follows the nearest ancestor's. */
  readonly density?: Density;
};

/**
 * A list of rows that follows the density: compact (tight rows, no line, the default) or roomy (a quiet line between
 * rows, more room around each), set with `data-density` on `<html>`, a page, a section, or with `density` here.
 */
export function List({ as: Element = "ul", surface = "page", density, className, ...props }: ListProps) {
  return (
    <Element
      data-slot="list"
      data-surface={surface}
      data-density={density}
      className={cn(surface === "tinted" ? LIST_CLASSES.tintedList : LIST_CLASSES.list, className)}
      {...props}
    />
  );
}

export type ListItemProps = ComponentProps<"li"> & {
  /** Renders the child element (a sortable item, an app's own `li`) with the item's classes. */
  readonly asChild?: boolean;
};

/** One entry of a `List`: the room between its row and the lines around it. */
export function ListItem({ asChild = false, className, ...props }: ListItemProps) {
  const Comp = asChild ? Slot.Root : "li";
  return <Comp data-slot="list-item" className={cn(LIST_CLASSES.item, className)} {...props} />;
}

export type ListRowProps = ComponentProps<"div"> & {
  /** Renders the child element (a `button`, a link) as the row, keeping its own element and role. */
  readonly asChild?: boolean;
};

/** A row in a `ListItem`: full width, the density's vertical padding, the theme's hover. */
export function ListRow({ asChild = false, className, ...props }: ListRowProps) {
  const Comp = asChild ? Slot.Root : "div";
  return <Comp data-slot="list-row" className={cn(LIST_CLASSES.row, className)} {...props} />;
}

/** The link a `ListEntry` title renders: a plain `a`, or the app's router link taking the same props. */
export type ListEntryLinkComponent = ElementType<{ href: string; className?: string; children?: ReactNode }>;

/** How a row's right column lays out its state and controls: stacked, or on one line with the state first. */
export type SideLayout = "stack" | "inline";

const LIST_ENTRY_COLUMN_CLASS: Record<SideLayout, string> = {
  stack: "flex min-w-0 flex-col items-end gap-1 has-[[data-row-wide]]:flex-1 has-[[data-row-wide]]:items-stretch",
  inline:
    "flex min-w-0 flex-row flex-wrap items-center justify-end gap-2 has-[[data-row-wide]]:flex-1 has-[[data-row-wide]]:flex-col has-[[data-row-wide]]:items-stretch has-[[data-row-wide]]:gap-1",
};

export type ListEntryProps = Omit<ComponentProps<"div">, "title" | "children"> & {
  /** What the row is: its name, in the medium weight. With `href` it is the link that opens the row. */
  readonly title: ReactNode;
  /** Lines under the title (facts, a path, a time), in the muted colour; the app lays out its own lines. */
  readonly details?: ReactNode;
  /** The row's state, at the top of the right column (one or more badges, which wrap right-aligned). */
  readonly status?: ReactNode;
  /**
   * How the right column lays out the state and the controls. `stack` (default): the state on top, the controls
   * under it. `inline`: the state left of the controls, on one line, wrapping right-aligned; a `data-row-wide`
   * control still takes the full-width column.
   */
  readonly sideLayout?: SideLayout;
  /**
   * The row's controls, under the status. They stay their own targets above the row's link, and are at least the
   * touch target (44 px) on a phone; a switch keeps its track and takes its 44 px square from `size="touch"` (with
   * `className="md:m-0 md:h-4 md:w-[26px]"` for the plain switch on a desktop). A control marked `data-row-wide` (an inline form that needs room) makes the right
   * column take the full row width under the identity, its lines starting on the left.
   */
  readonly actions?: ReactNode;
  /**
   * The row's other actions behind a "More actions" button (a `RowActionsMenu`), at the end of the actions line: it
   * stays on one line with the inline control and is at least the touch target (44 px) on a phone.
   */
  readonly menu?: ReactNode;
  /** The row opens this address: the title's link is stretched over the whole row, with an arrow at its right. */
  readonly href?: string;
  /** The element for the link (a router's link component); a plain `a` by default. */
  readonly linkComponent?: ListEntryLinkComponent;
};

function isDrawn(node: ReactNode): boolean {
  return node !== undefined && node !== null && node !== false;
}

/**
 * A list row with an identity and a right column: the title and its detail lines on the left, the row's state at the
 * top of the right column and its controls under it (with `sideLayout="inline"`, the state left of the controls on one
 * line). Both sides align to the top, so the state stands on the title's
 * line however many detail lines the identity has. With `href` the title is a link stretched over the whole row, so
 * the row is one box lit on hover, and an arrow sits beside the column on the title's line (never on a line of its
 * own); the column stays above the link. On a phone (below `md`) the column wraps under the identity, right-aligned. Place it in a `ListItem`.
 *
 * Row controls: at most one control inline in `actions` (a switch, or the row's one primary action); every other
 * action goes into `menu`, the destructive one last. A row with a single action keeps it inline and has no menu.
 * Row state: each fact once. A switch is its own on/off state (no badge or label repeating it); a `ResultBadge`
 * carries its own icon, so no separate state icon stands next to it.
 */
export function ListEntry({
  title,
  details,
  status,
  sideLayout = "stack",
  actions,
  menu,
  href,
  linkComponent: Link = "a",
  className,
  ...props
}: ListEntryProps) {
  const hasStatus = isDrawn(status);
  const hasActions = isDrawn(actions);
  const hasMenu = isDrawn(menu);
  const hasControls = hasActions || hasMenu;
  const hasColumn = hasStatus || hasControls;
  const hasLink = href !== undefined;
  const titleClasses = "min-w-0 text-ui-medium text-foreground";
  return (
    <div
      data-slot="list-entry"
      className={cn(
        "relative flex w-full min-w-0 flex-wrap items-start gap-x-3 gap-y-1 rounded-md px-2 py-(--list-row-y) text-ui transition-colors duration-100 hover:bg-accent",
        "has-[[data-slot=list-entry-title]:focus-visible]:ring-2 has-[[data-slot=list-entry-title]:focus-visible]:ring-ring",
        className,
      )}
      {...props}
    >
      <div data-slot="list-entry-identity" className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5 max-md:basis-full">
        {hasLink ? (
          <Link
            data-slot="list-entry-title"
            href={href}
            className={cn(titleClasses, "outline-none after:absolute after:inset-0 after:rounded-md after:content-['']")}
          >
            {title}
          </Link>
        ) : (
          <span data-slot="list-entry-title" className={titleClasses}>
            {title}
          </span>
        )}
        {isDrawn(details) ? (
          <div data-slot="list-entry-details" className="flex min-w-0 flex-col text-ui text-muted-foreground">
            {details}
          </div>
        ) : null}
      </div>
      {hasColumn || hasLink ? (
        <div
          data-slot="list-entry-side"
          className="group/list-entry-side pointer-events-none relative z-10 ml-auto flex max-w-full min-w-0 flex-nowrap items-start gap-2 has-[[data-row-wide]]:ml-0 has-[[data-row-wide]]:basis-full"
        >
          {hasColumn ? (
            <div
              data-slot="list-entry-column"
              data-side-layout={sideLayout}
              className={LIST_ENTRY_COLUMN_CLASS[sideLayout]}
            >
              {hasStatus ? (
                <div
                  data-slot="list-entry-status"
                  className="pointer-events-auto flex min-w-0 flex-wrap items-center justify-end gap-1 group-has-[[data-row-wide]]/list-entry-side:justify-start"
                >
                  {status}
                </div>
              ) : null}
              {hasControls ? (
                <div
                  data-slot="list-entry-actions"
                  className={cn(
                    "pointer-events-auto flex min-w-0 items-center justify-end gap-1 has-[[data-row-wide]]:flex-col has-[[data-row-wide]]:items-stretch has-[[data-row-wide]]:justify-start max-md:*:not-data-[slot=switch]:min-h-touch-target max-md:*:not-data-[slot=switch]:min-w-touch-target max-md:*:data-[slot=switch]:mx-0",
                    hasMenu ? "flex-nowrap" : "flex-wrap",
                  )}
                >
                  {actions}
                  {hasMenu ? (
                    <div
                      data-slot="list-entry-menu"
                      className="flex shrink-0 items-center justify-center max-md:*:min-h-touch-target max-md:*:min-w-touch-target"
                    >
                      {menu}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
          {hasLink ? (
            <span data-slot="list-entry-arrow" aria-hidden="true" className="flex h-5 shrink-0 items-center text-muted-foreground">
              <ChevronRight strokeWidth={ICON_STROKE_WIDTH} className="size-4" />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export type ListGroupProps = ComponentProps<"div"> & {
  /** Renders the child element (a `section`, an app's own `li`) with the group's classes. */
  readonly asChild?: boolean;
};

/**
 * A run of rows under a `ListGroupHeading` (a country's days, a month's entries), placed straight in the scroll
 * container, which has no top padding of its own: the heading sticks at the top while the group's rows pass under it,
 * and the next group's heading pushes it away. The group holds the side room the heading bleeds over, so the heading
 * spans the whole scrollport; a row scrolled into view (`block: "nearest"`) stops below the heading.
 */
export function ListGroup({ asChild = false, className, ...props }: ListGroupProps) {
  const Comp = asChild ? Slot.Root : "div";
  return <Comp data-slot="list-group" className={cn(LIST_CLASSES.group, className)} {...props} />;
}

export type ListGroupHeadingProps = ComponentProps<"div"> & {
  /** `tinted` on a grey card: the heading takes the card's `secondary`, its line the page's `background`. */
  readonly surface?: ListSurface;
  /** Renders the child element (an `h2`, an `h3`) as the heading, keeping its own element. */
  readonly asChild?: boolean;
};

/** The heading of a `ListGroup`: sticks at the top of the scroll container, full width, a line under it. */
export function ListGroupHeading({ surface = "page", asChild = false, className, ...props }: ListGroupHeadingProps) {
  const Comp = asChild ? Slot.Root : "div";
  return (
    <Comp
      data-slot="list-group-heading"
      data-surface={surface}
      className={cn(surface === "tinted" ? LIST_CLASSES.tintedGroupHeading : LIST_CLASSES.groupHeading, className)}
      {...props}
    />
  );
}
