/**
 * How much room a list gives its rows: `compact` (tight rows, no line between them) or `roomy` (a quiet line between
 * rows and more room around each). A page, a section or a panel picks one with `data-density`; the nearest attribute
 * wins, and an element without one is compact.
 */
export const DENSITIES = ["compact", "roomy"] as const;

export type Density = (typeof DENSITIES)[number];

/** One density's lengths, as CSS lengths. */
export interface DensityScale {
  /** The vertical padding of a row (`--list-row-y`). */
  rowPaddingY: string;
  /** The room between a row and the lines above and below it, on the list item (`--list-item-y`). */
  itemPaddingY: string;
  /** The width of the line between two rows; `0px` draws none (`--list-divider-width`). */
  dividerWidth: string;
}

/** The CSS variable each length of a scale is written to. */
export const LIST_DENSITY_VARIABLES = {
  rowPaddingY: "--list-row-y",
  itemPaddingY: "--list-item-y",
  dividerWidth: "--list-divider-width",
} as const satisfies Record<keyof DensityScale, `--${string}`>;

/** The scale a theme gets when its definition sets none: compact is the 4 px grid's tight row, roomy one step more. */
export const DEFAULT_DENSITY: Readonly<Record<Density, Readonly<DensityScale>>> = {
  compact: { rowPaddingY: "0.25rem", itemPaddingY: "0px", dividerWidth: "0px" },
  roomy: { rowPaddingY: "0.5rem", itemPaddingY: "0.25rem", dividerWidth: "1px" },
};
