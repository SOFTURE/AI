import type { OgFontFamily } from "../fonts.js";
import type { OgNode } from "../element.js";
import type { OgPalette } from "../palette.js";

/** What every template draws with, besides its own `data`. */
export interface OgTemplateContext {
  width: number;
  height: number;
  /** Template sizes are written for the layout's base card and multiplied by this (see `getLayoutScale`). */
  scale: number;
  palette: OgPalette;
  fonts: { heading: OgFontFamily; body: OgFontFamily };
  brand: { name: string; /** The logo as a data URI, or null. */ logo: string | null };
}

export interface OgTemplate<Data> {
  /** Draws the card; `data` has passed the template's schema. `slide` is 1-based; single cards have only slide 1. */
  build(data: Data, context: OgTemplateContext, slide: number): OgNode;
}

export const BASE_WIDTH = 1200;

/**
 * The card a template is written for. `landscape` templates (the 1200×630 share cards) scale by width alone, as
 * they always did; `portrait` templates are written for a 1080×1350 post and scale by the limiting side, so a
 * square or a story never overflows what the portrait fits.
 */
export type OgLayout = "landscape" | "portrait";

export const PORTRAIT_BASE: readonly [number, number] = [1080, 1350];

export function getLayoutScale(layout: OgLayout, width: number, height: number): number {
  if (layout === "landscape") return width / BASE_WIDTH;
  return Math.min(width / PORTRAIT_BASE[0], height / PORTRAIT_BASE[1]);
}
