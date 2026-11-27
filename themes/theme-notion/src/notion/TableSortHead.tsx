"use client";

import { ChevronDown, ChevronsUpDown, ChevronUp } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../lib/utils.js";
import { en as messages } from "../messages/en.js";
import { Button } from "../ui/button.js";
import { TableHead } from "../ui/table.js";

import { ICON_STROKE_WIDTH } from "./icon-stroke.js";

/** A column's sort direction; `none` while the table is not sorted by it. */
export type SortDirection = "ascending" | "descending" | "none";

/** `three-state` goes none, descending, ascending, none; `two-state` never returns to none. */
export type SortCycle = "three-state" | "two-state";

/** The direction a press on a sortable header asks for next. */
export function nextSortDirection(direction: SortDirection, cycle: SortCycle = "three-state"): SortDirection {
  if (direction === "none") return "descending";
  if (direction === "descending") return "ascending";
  return cycle === "two-state" ? "descending" : "none";
}

export interface TableSortHeadProps extends Omit<ComponentProps<"th">, "children" | "aria-sort" | "align"> {
  /** The column's name, shown in the button. */
  readonly children: ReactNode;
  /** The column's current direction; `aria-sort` is set only when it is not `none`. */
  readonly direction: SortDirection;
  /** Told the next direction when the header is pressed; the app sorts its rows. */
  readonly onSortChange: (next: SortDirection) => void;
  /** The order a press walks through; `three-state` by default. */
  readonly cycle?: SortCycle;
  /**
   * Hidden text in the button that announces what a press does; the English default names the next direction
   * ("Sort descending", "Sort ascending", "Remove sorting").
   */
  readonly label?: string;
  /** `end` for a right-aligned column, such as amounts; `start` by default. */
  readonly align?: "start" | "end";
  /** Classes of the button. */
  readonly buttonClassName?: string;
}

const NEXT_LABEL: Readonly<Record<SortDirection, string>> = {
  descending: messages.tableSortHead.descending,
  ascending: messages.tableSortHead.ascending,
  none: messages.tableSortHead.none,
};

const ICON: Readonly<Record<SortDirection, typeof ChevronDown>> = {
  ascending: ChevronUp,
  descending: ChevronDown,
  none: ChevronsUpDown,
};

/**
 * A table column header that sorts its column: a ghost button with the column's name and a chevron for the
 * direction (a muted up-down one while unsorted), `aria-sort` on the sorted `<th>` only, and hidden text naming what
 * a press does. A press asks the app for the next direction; the native button is the tab stop and Enter and Space
 * press it. Sorting itself stays in the app (`sortRows` sorts an array in memory).
 */
export function TableSortHead({
  children,
  direction,
  onSortChange,
  cycle = "three-state",
  label,
  align = "start",
  buttonClassName,
  className,
  ...props
}: TableSortHeadProps) {
  const next = nextSortDirection(direction, cycle);
  const Icon = ICON[direction];
  const isSorted = direction !== "none";

  return (
    <TableHead
      data-slot="table-sort-head"
      data-sort={direction}
      {...(isSorted ? { "aria-sort": direction } : {})}
      className={cn(align === "end" && "text-right", className)}
      {...props}
    >
      <Button
        data-slot="table-sort-button"
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "h-7 text-sm font-normal",
          align === "end" ? "-mr-2" : "-ml-2",
          isSorted && "text-foreground",
          buttonClassName,
        )}
        onClick={() => {
          onSortChange(next);
        }}
      >
        {children}
        <Icon strokeWidth={ICON_STROKE_WIDTH} aria-hidden="true" className={cn(!isSorted && "opacity-50")} />
        <span data-slot="table-sort-label" className="sr-only">
          {label ?? NEXT_LABEL[next]}
        </span>
      </Button>
    </TableHead>
  );
}

type SortKey<T> = keyof T | ((row: T) => unknown);

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

function isEmpty(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function compareValues(left: unknown, right: unknown): number {
  if (typeof left === "number" && typeof right === "number") return left - right;
  if (typeof left === "bigint" && typeof right === "bigint") return left < right ? -1 : left > right ? 1 : 0;
  if (left instanceof Date && right instanceof Date) return left.getTime() - right.getTime();
  if (typeof left === "boolean" && typeof right === "boolean") return Number(left) - Number(right);
  return COLLATOR.compare(String(left), String(right));
}

/**
 * Rows sorted by one column, in a new array. Stable in both directions: rows with equal values keep their order
 * (descending negates the comparison rather than reversing the result). Empty values (`null`, `undefined`) go last
 * in both directions. The default comparison takes numbers, bigints, dates and booleans by value and strings with
 * numeric, case-insensitive collation ("Item 2" before "Item 10"); `compare` replaces it for present values.
 * `none` keeps the input order.
 */
export function sortRows<T>(
  rows: readonly T[],
  key: SortKey<T>,
  direction: SortDirection,
  compare: (left: unknown, right: unknown) => number = compareValues,
): T[] {
  if (direction === "none") return [...rows];
  const read = typeof key === "function" ? key : (row: T): unknown => row[key];
  const sign = direction === "ascending" ? 1 : -1;
  return [...rows].sort((leftRow, rightRow) => {
    const left = read(leftRow);
    const right = read(rightRow);
    if (isEmpty(left) || isEmpty(right)) return Number(isEmpty(left)) - Number(isEmpty(right));
    return sign * compare(left, right);
  });
}
