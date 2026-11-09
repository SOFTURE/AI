import type { ComponentProps, CSSProperties } from "react";

import { cn } from "../lib/utils.js";

export type FormGridColumns = 1 | 2 | 3;

export interface FormGridProps extends ComponentProps<"div"> {
  // Columns from `md` up (one column below); 2 by default.
  readonly columns?: FormGridColumns;
  // The rows each field takes: label, control and hint by default. A field with more parts (an error, a reset button)
  // passes more, or wraps the extra parts in one element.
  readonly rows?: number;
}

const COLUMNS: Readonly<Record<FormGridColumns, string>> = {
  1: "grid-cols-1",
  2: "grid-cols-1 md:grid-cols-2",
  3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
};

// Fields side by side whose label, control and hint line up across the columns: each child `Field` spans `rows` rows
// of the grid, and a vertical field lays its parts out on those shared rows (CSS subgrid), so a label that wraps in
// one column moves the controls of the whole row down together, and the shorter label sits on its control. A
// horizontal field (a switch with its label) keeps its own row layout inside the same area.
export function FormGrid({ columns = 2, rows = 3, className, style, ...props }: FormGridProps) {
  // A whole number of rows, at least one; anything else falls back to the default three.
  const span = Number.isFinite(rows) ? Math.max(1, Math.trunc(rows)) : 3;
  return (
    <div
      data-slot="form-grid"
      data-columns={columns}
      style={{ "--form-grid-rows": String(span), ...style } as CSSProperties}
      className={cn(
        "grid gap-x-6 gap-y-6",
        COLUMNS[columns],
        "*:data-[slot=field]:row-span-(--form-grid-rows)",
        "*:data-[slot=field]:data-[orientation=vertical]:grid *:data-[slot=field]:data-[orientation=vertical]:grid-rows-subgrid",
        "*:data-[slot=field]:data-[orientation=vertical]:*:m-0",
        // A one-line label beside a two-line one sits on its control, as a label does in a single field.
        "*:data-[slot=field]:data-[orientation=vertical]:*:first:self-end",
        className,
      )}
      {...props}
    />
  );
}
