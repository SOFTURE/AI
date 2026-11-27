// A table's sort state and an in-memory sort, free of React so a Server Component can sort its rows too.

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
