import { getContrastRatio, type BrandColors } from "../config/colors.js";
import type { CaptionEntrance, FootageFilm } from "./film.js";

/**
 * How a footage film's `highlight` captions light the word being said (issue #1199): its text in `captionHighlight`
 * (`text`), the word on a rounded box of `captionHighlightBox` with its text in `captionHighlightText` (`box`), or the
 * word in its own text colour over an underline of `captionHighlight` (`underline`). The render and the draft both
 * draw what this resolves.
 */

export type CaptionHighlightLook = { style: "text"; color: string } | { style: "box"; box: string; text: string } | { style: "underline"; color: string };

export type CaptionHighlightResult = { ok: true; look: CaptionHighlightLook } | { ok: false; error: string };

/** The colours the look reads. */
export type CaptionHighlightColors = Pick<BrandColors, "captionHighlight" | "captionHighlightBox" | "captionHighlightText">;

/** How long a word stays lit from its start, in seconds (render and draft alike). */
export const CAPTION_HIGHLIGHT_SECONDS = 0.32;

/** The box's padding beside the lit word, in font sizes; above and below, the line's own height is the room. */
export const CAPTION_HIGHLIGHT_BOX_PADDING_EM = 0.15;

/** The box's corner radius, in px: a little over half the pill's 22 px, so the box nests in the pill's rounding. */
export const CAPTION_HIGHLIGHT_BOX_RADIUS = 12;

/**
 * The underline under a lit word, in font sizes: its thickness, and how far its top sits below the line's top (the
 * baseline's neighbourhood of a bold sans-serif at the pill's 1.18 line height).
 */
export const CAPTION_UNDERLINE_EM = { thickness: 0.09, top: 1.0 } as const;

/** How long the pill's entrance lasts, in seconds; `pop` grows from this share of its size. */
export const CAPTION_ENTRANCE_SECONDS = 0.16;
export const CAPTION_POP_FROM_SCALE = 0.96;

/** A pill's entrance as a GSAP `fromTo` (`from`, `to` vars), or null for `none`; absent: the 14 px rise and fade. */
export function getCaptionEntranceTween(entrance: CaptionEntrance | undefined): { from: Record<string, number>; to: Record<string, number | string> } | null {
  const timing = { duration: CAPTION_ENTRANCE_SECONDS };
  if (entrance === undefined) return { from: { y: 14, opacity: 0 }, to: { y: 0, opacity: 1, ...timing, ease: "power3.out" } };
  if (entrance === "none") return null;
  if (entrance === "fade") return { from: { opacity: 0 }, to: { opacity: 1, ...timing, ease: "power1.out" } };
  // An ease that ends at its target and never past it: the pill grows to 100 %, not beyond.
  return { from: { scale: CAPTION_POP_FROM_SCALE, opacity: 0 }, to: { scale: 1, opacity: 1, ...timing, ease: "power2.out" } };
}

/** The film's highlight look, or an error naming the missing brand colours when it asks for a box without them. */
export function getCaptionHighlight(film: Pick<FootageFilm, "captionHighlightStyle">, colors: CaptionHighlightColors): CaptionHighlightResult {
  const style = film.captionHighlightStyle ?? "text";
  if (style === "text" || style === "underline") return { ok: true, look: { style, color: colors.captionHighlight } };
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
