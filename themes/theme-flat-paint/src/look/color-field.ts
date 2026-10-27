/** The slots of `@softure-ai/ui`'s `ColorField` (its `Field` slots and its own). */
export type ColorFieldSlot =
  | "root"
  | "labelRow"
  | "label"
  | "tooltip"
  | "error"
  | "hint"
  | "presets"
  | "preset"
  | "row"
  | "swatch"
  | "input";

/**
 * The colour field in ui's `classNames`: square presets that take a 2 px `foreground` frame when picked (instead of
 * round ones with a ring), and the native picker 28 × 36 px in `line-strong` on `surface-raised`.
 */
export const COLOR_FIELD_LOOK: Readonly<Partial<Record<ColorFieldSlot, string>>> = {
  preset:
    "rounded-none aria-checked:border-2 aria-checked:border-foreground aria-checked:ring-0 aria-checked:ring-offset-0",
  swatch: "h-9 w-7 border-line-strong bg-surface-raised",
};
