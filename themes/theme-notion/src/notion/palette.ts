// The design system's nine palette colours. A colour marks an area (a tag) or a state (a status, a callout), never
// decoration, and always means the same thing; each app keeps its own table of which meaning takes which colour.
export const PALETTE_COLORS = ["gray", "brown", "orange", "yellow", "green", "blue", "purple", "pink", "red"] as const;

export type PaletteColor = (typeof PALETTE_COLORS)[number];
