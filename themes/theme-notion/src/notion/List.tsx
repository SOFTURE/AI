import type { Density } from "@softure-ai/theme-kit";
import { Slot } from "radix-ui";
import type { ComponentProps } from "react";

import { cn } from "../lib/utils.js";

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
