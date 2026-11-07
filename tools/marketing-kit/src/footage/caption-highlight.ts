import { getContrastRatio, type BrandColors } from "../config/colors.js";
import type { FootageFilm } from "./film.js";

/**
 * How a footage film's `highlight` captions light the word being said (issue #1199): its text in `captionHighlight`
 * (`text`), or the word on a rounded box of `captionHighlightBox` with its text in `captionHighlightText` (`box`).
 * The render and the draft both draw what this resolves.
 */

export type CaptionHighlightLook = { style: "text"; color: string } | { style: "box"; box: string; text: string };

export type CaptionHighlightResult = { ok: true; look: CaptionHighlightLook } | { ok: false; error: string };

/** The colours the look reads. */
export type CaptionHighlightColors = Pick<BrandColors, "captionHighlight" | "captionHighlightBox" | "captionHighlightText">;

/** How long a word stays lit from its start, in seconds (render and draft alike). */
export const CAPTION_HIGHLIGHT_SECONDS = 0.32;

/** The box's padding beside the lit word, in font sizes; above and below, the line's own height is the room. */
export const CAPTION_HIGHLIGHT_BOX_PADDING_EM = 0.15;

/** The box's corner radius, in px: a little over half the pill's 22 px, so the box nests in the pill's rounding. */
export const CAPTION_HIGHLIGHT_BOX_RADIUS = 12;

/** The film's highlight look, or an error naming the missing brand colours when it asks for a box without them. */
export function getCaptionHighlight(film: Pick<FootageFilm, "captionHighlightStyle">, colors: CaptionHighlightColors): CaptionHighlightResult {
  if ((film.captionHighlightStyle ?? "text") === "text") return { ok: true, look: { style: "text", color: colors.captionHighlight } };
  const { captionHighlightBox: box, captionHighlightText: text } = colors;
  if (box === undefined || text === undefined) {
    const missing = [box === undefined ? "captionHighlightBox" : null, text === undefined ? "captionHighlightText" : null].filter((role) => role !== null);
    return { ok: false, error: `captionHighlightStyle "box" needs the brand colours ${missing.join(" and ")} (brand.colors or brand.tokensFrom).` };
  }
  return { ok: true, look: { style: "box", box, text } };
}

export interface CaptionHighlightContrast {
  /** The lit word's text (`captionHighlightText`) against its box (`captionHighlightBox`). */
  textOnBox: number;
  /** The box (`captionHighlightBox`) against the pill (`captionBackground`). */
  boxOnPill: number;
}

/**
 * The WCAG contrast ratios of a `box` highlight, for the app to warn on (the kit never changes the colours): the lit
 * text on its box, and the box on the pill. Null when either box colour is missing.
 */
export function getCaptionHighlightContrast(colors: Pick<BrandColors, "captionBackground" | "captionHighlightBox" | "captionHighlightText">): CaptionHighlightContrast | null {
  const { captionHighlightBox: box, captionHighlightText: text } = colors;
  if (box === undefined || text === undefined) return null;
  return { textOnBox: getContrastRatio(text, box), boxOnPill: getContrastRatio(box, colors.captionBackground) };
}
