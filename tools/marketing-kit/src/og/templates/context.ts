import type { OgFontFamily } from "../fonts.js";
import type { OgNode } from "../element.js";
import type { OgPalette } from "../palette.js";

/** What every template draws with, besides its own `data`. */
export interface OgTemplateContext {
  width: number;
  height: number;
  /** `width / 1200`: template sizes are written for a 1200-pixel-wide card and multiplied by this. */
  scale: number;
  palette: OgPalette;
  fonts: { heading: OgFontFamily; body: OgFontFamily };
  brand: { name: string; /** The logo as a data URI, or null. */ logo: string | null };
}

export interface OgTemplate<Data> {
  /** Draws the card; `data` has passed the template's schema. */
  build(data: Data, context: OgTemplateContext): OgNode;
}

export const BASE_WIDTH = 1200;

