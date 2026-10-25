import type { PaletteColor } from "./palette.js";

// A figure's colour by what it means: done, to do, owed or failing, out of play, or neutral. Each app keeps its own
// table of which meaning takes which tone ("booked" → success); the theme owns the colours and the class names.
export const TONES = ["default", "success", "warning", "danger", "muted"] as const;

export type Tone = (typeof TONES)[number];

// A tone's palette colour; `default` has none and reads in the text colour.
export const TONE_COLORS: Readonly<Record<Tone, PaletteColor | null>> = {
  default: null,
  success: "green",
  warning: "orange",
  danger: "red",
  muted: "gray",
};

// Literal class names per tone, so Tailwind generates each one (the theme's `@source` covers this folder).

// A figure written in its tone's colour.
export const TONE_TEXT: Readonly<Record<Tone, string>> = {
  default: "text-foreground",
  success: "text-green",
  warning: "text-orange",
  danger: "text-red",
  muted: "text-gray",
};

// A drawn share (a bar segment) in its tone's colour; the default is a quiet gray.
export const TONE_FILL: Readonly<Record<Tone, string>> = {
  default: "bg-gray",
  success: "bg-green",
  warning: "bg-orange",
  danger: "bg-red",
  muted: "bg-gray",
};

// A box's leading edge in its tone's colour; the default is a quiet gray.
export const TONE_EDGE: Readonly<Record<Tone, string>> = {
  default: "border-l-gray",
  success: "border-l-green",
  warning: "border-l-orange",
  danger: "border-l-red",
  muted: "border-l-gray",
};
