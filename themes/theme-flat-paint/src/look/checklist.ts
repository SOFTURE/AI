/** The slots of `@softure-ai/ui`'s `Checklist`. */
export type ChecklistSlot =
  | "root"
  | "progress"
  | "list"
  | "item"
  | "row"
  | "marker"
  | "body"
  | "label"
  | "link"
  | "description"
  | "trailing";

/**
 * The checklist in ui's `classNames`: a hairline list (no gap, a line between rows and above and below it), a row
 * that turns `surface-raised` on hover with the `accent` focus ring, a round `line-strong` marker that turns
 * `accessible` (filled at 20 %) once the item is done, and a done label in normal weight, `muted` and struck through.
 * The done look follows the `data-done` ui sets on each item.
 */
export const CHECKLIST_LOOK: Readonly<Partial<Record<ChecklistSlot, string>>> = {
  list: "gap-0 divide-y divide-border border-y border-border",
  row: "hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
  marker:
    "border-line-strong bg-transparent in-data-done:border-accessible in-data-done:bg-accessible/20 in-data-done:text-accessible",
  label: "in-data-done:font-normal in-data-done:text-muted in-data-done:line-through",
};
