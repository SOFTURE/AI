import { readCharacterMap } from "../og/character-map.js";
import { OutOfBounds, readFontTables, readInt16, readUint16 } from "../og/font-tables.js";

/**
 * The width of a line of text as libass draws it in a footage draft, measured from the draft font's own advance
 * widths (`hmtx` through `cmap`), so the draft can draw a rounded caption pill that fits its text (libass sizes only
 * its square `BorderStyle 3` box itself). libass scales a font the VSFilter way: `usWinAscent + usWinDescent` (OS/2,
 * else the `hhea` ascender and descender) is the font size, so a line is one font size tall and an advance is
 * `advance * fontSize / (winAscent + winDescent)`. Kerning is not read: a few px on a line, inside the pill's padding.
 */
export type DraftTextMeasure = (text: string, fontSize: number) => number;

interface Metrics {
  /** The font's units per libass font size: `usWinAscent + usWinDescent`. */
  unitsPerSize: number;
  /** How far below a line's top libass sets its baseline, in font units: `usWinAscent` (else the `hhea` ascender). */
  drawnAscent: number;
  /** How far above a line's foot libass sets its baseline, in font units: `usWinDescent` (else the `hhea` descender). */
  drawnDescent: number;
  /** The font's units per em (`head`), what a browser sizes it by; 0 when the font has no `head`. */
  unitsPerEm: number;
  advances: (glyph: number) => number;
  /** The ascent and descent of a browser's inline box, in font units: `hhea`'s, or OS/2's typo metrics when the font says to use them. */
  ascent: number;
  descent: number;
}

/** OS/2 `fsSelection` bit 7: a browser takes the typo ascender and descender for the line's content area. */
const USE_TYPO_METRICS = 1 << 7;

/** The content area's ascent and descent in font units, as a browser reads them (`hhea`, or typo metrics on request). */
function readContentArea(hhea: Buffer, os2: Buffer | undefined): { ascent: number; descent: number } {
  if (os2 !== undefined && os2.length >= 72 && (readUint16(os2, 62) & USE_TYPO_METRICS) !== 0) return { ascent: readInt16(os2, 68), descent: -readInt16(os2, 70) };
  return { ascent: readInt16(hhea, 4), descent: -readInt16(hhea, 6) };
}

function readMetrics(font: Buffer): Metrics | null {
  const tables = readFontTables(font);
  if (!tables.ok) return null;
  const hhea = tables.value.get("hhea");
  const hmtx = tables.value.get("hmtx");
  if (hhea === undefined || hmtx === undefined) return null;
  const os2 = tables.value.get("OS/2");
  const winSum = os2 === undefined ? 0 : readUint16(os2, 74) + readUint16(os2, 76);
  const unitsPerSize = winSum > 0 ? winSum : readInt16(hhea, 4) - readInt16(hhea, 6);
  const isWin = winSum > 0 && os2 !== undefined;
  const drawnAscent = isWin ? readUint16(os2, 74) : readInt16(hhea, 4);
  const drawnDescent = isWin ? readUint16(os2, 76) : -readInt16(hhea, 6);
  const count = readUint16(hhea, 34);
  if (unitsPerSize <= 0 || count === 0 || hmtx.length < count * 4) return null;
  const head = tables.value.get("head");
  const unitsPerEm = head === undefined ? 0 : readUint16(head, 18);
  // Glyphs past `numberOfHMetrics` share the last advance (OpenType `hmtx`).
  return { unitsPerSize, drawnAscent, drawnDescent, unitsPerEm, advances: (glyph) => readUint16(hmtx, Math.min(glyph, count - 1) * 4), ...readContentArea(hhea, os2) };
}

/**
 * A measure of the draft font `font` (a TrueType or OpenType file), or null when its tables cannot be read; the
 * caller then falls back to an estimate. A character the font lacks is measured as its `.notdef` glyph, as drawn.
 */
export function createDraftTextMeasure(font: Buffer): DraftTextMeasure | null {
  try {
    const metrics = readMetrics(font);
    const characters = readCharacterMap(font);
    if (metrics === null || !characters.ok) return null;
    const map = characters.value;
    return (text, fontSize) => {
      let units = 0;
      for (const character of text) units += metrics.advances(map.getGlyph(character.codePointAt(0) ?? 0));
      return Math.ceil((units * fontSize) / metrics.unitsPerSize);
    };
  } catch (error) {
    if (error instanceof OutOfBounds) return null;
    throw error;
  }
}

/**
 * A font of a footage draft as the render sizes it. Every size in the draft is a CSS px size, as in the render; libass
 * sizes a font by `usWinAscent + usWinDescent`, so an ASS size is written through `toAssSize`, and the text is as large
 * as the browser draws it (an em of `cssPx`). `measure` gives a line's width at a CSS size, as the browser lays it.
 */
export interface DraftFont {
  /** The family libass knows the file by (its `name` table). */
  family: string;
  file: string;
  /** The libass size that draws one CSS px: `(usWinAscent + usWinDescent) / unitsPerEm`. */
  assScale: number;
  /** A line's width in CSS px at a CSS font size (advances per em; kerning not read). */
  measure: DraftTextMeasure;
  /**
   * The ascent and descent of the render's inline box (a highlight mark's background), in ems; absent for a font made
   * elsewhere, which then takes `DEFAULT_CONTENT_AREA`.
   */
  contentArea?: { ascentEm: number; descentEm: number };
  /**
   * How far below a line's top libass sets the baseline, in ems: `usWinAscent / unitsPerEm`. A browser sets it at the
   * half-leading plus the content area's ascent, so a line placed by its top is moved by the difference
   * (`getDraftLineShift`); absent for a font made elsewhere, which is not moved.
   */
  drawnAscentEm?: number;
  /** How far above a line's foot libass sets the baseline, in ems: `usWinDescent / unitsPerEm`; absent with `drawnAscentEm`. */
  drawnDescentEm?: number;
}

/** The content area a font without its own is given, in ems: a common sans serif's. */
export const DEFAULT_CONTENT_AREA = { ascentEm: 0.93, descentEm: 0.24 } as const;

/** The ASS size (`Fontsize`, `\fs`) that draws a font of `assScale` as large as the render's `cssPx`, to 0.01. */
export function toDraftAssSize(cssPx: number, assScale: number): number {
  return Math.round(cssPx * assScale * 100) / 100;
}

/**
 * How far to move a line of `font` drawn by its top (`\\an7`, `\\an8`, `\\an9`) so its baseline stands where the
 * render's does in a line box of `lineHeightEm` at `cssPx`, in px (negative: up). libass sets the baseline
 * `drawnAscentEm` below the top; a browser half the leading plus the content area's ascent. 0 for a font without its
 * metrics (as before).
 */
export function getDraftLineShift(font: Pick<DraftFont, "contentArea" | "drawnAscentEm">, cssPx: number, lineHeightEm: number): number {
  if (font.drawnAscentEm === undefined || font.contentArea === undefined) return 0;
  const { ascentEm, descentEm } = font.contentArea;
  const browserBaseline = (lineHeightEm - ascentEm - descentEm) / 2 + ascentEm;
  return Math.round((browserBaseline - font.drawnAscentEm) * cssPx * 100) / 100;
}

/**
 * How far to move a line of `font` drawn by its middle (`\\an4`, `\\an5`, `\\an6`) so its baseline stands where a
 * browser's does in a line box centred on the same point, in px (negative: up): a browser's baseline stands half the
 * content area's ascent less its descent below the middle, libass's half the win ascent less the win descent. 0 for a
 * font without its metrics (as before).
 */
export function getDraftMiddleShift(font: Pick<DraftFont, "contentArea" | "drawnAscentEm" | "drawnDescentEm">, cssPx: number): number {
  if (font.drawnAscentEm === undefined || font.drawnDescentEm === undefined || font.contentArea === undefined) return 0;
  const { ascentEm, descentEm } = font.contentArea;
  return Math.round(((ascentEm - descentEm - (font.drawnAscentEm - font.drawnDescentEm)) / 2) * cssPx * 100) / 100;
}

/** The ASS letter spacing (`\\fsp`, `Spacing`, in the frame's px) of the render's `letter-spacing` of `spacingEm` at `cssPx`, to 0.01. */
export function toDraftSpacing(spacingEm: number, cssPx: number): number {
  return Math.round(spacingEm * cssPx * 100) / 100;
}

/** What a letter spacing of `spacingEm` adds to a line at `cssPx`: once after every character, as a browser spaces them. */
export function getSpacingWidth(text: string, spacingEm: number, cssPx: number): number {
  // `+ 0` turns an empty line's -0 into 0.
  return [...text].length * spacingEm * cssPx + 0;
}

/** `measure` with the letters spaced `spacingEm`, as the render's `letter-spacing` spaces them. */
export function withLetterSpacing(measure: DraftTextMeasure, spacingEm: number): DraftTextMeasure {
  return (text, fontSize) => Math.ceil(measure(text, fontSize) + getSpacingWidth(text, spacingEm, fontSize) - 1e-9);
}

/**
 * The draft font of `data` (a TrueType or OpenType file) known to libass as `family`, or null when its tables cannot be
 * read (no `hhea`, `hmtx`, `head` or `cmap`). A character the font lacks is measured as its `.notdef` glyph.
 */
export function createDraftFont(source: { family: string; file: string }, data: Buffer): DraftFont | null {
  try {
    const metrics = readMetrics(data);
    const characters = readCharacterMap(data);
    if (metrics === null || metrics.unitsPerEm === 0 || !characters.ok) return null;
    const map = characters.value;
    const { unitsPerEm } = metrics;
    return {
      family: source.family,
      file: source.file,
      assScale: metrics.unitsPerSize / unitsPerEm,
      contentArea: { ascentEm: metrics.ascent / unitsPerEm, descentEm: metrics.descent / unitsPerEm },
      drawnAscentEm: metrics.drawnAscent / unitsPerEm,
      drawnDescentEm: metrics.drawnDescent / unitsPerEm,
      measure: (text, fontSize) => {
        let units = 0;
        for (const character of text) units += metrics.advances(map.getGlyph(character.codePointAt(0) ?? 0));
        // Float noise must not round a whole width up; `+ 0` turns an empty line's -0 into 0.
        return Math.ceil((units * fontSize) / unitsPerEm - 1e-9) + 0;
      },
    };
  } catch (error) {
    if (error instanceof OutOfBounds) return null;
    throw error;
  }
}

/**
 * Words broken into lines that fit `width` by `measure`, greedily as a browser breaks the render's pill: each line is
 * its words, and a word wider than a line stands alone on its own.
 */
export function wrapDraftLine(words: readonly string[], width: number, fontSize: number, measure: DraftTextMeasure): string[][] {
  const lines: string[][] = [];
  for (const word of words) {
    const last = lines[lines.length - 1];
    if (last !== undefined && measure([...last, word].join(" "), fontSize) <= width) last.push(word);
    else lines.push([word]);
  }
  return lines;
}
