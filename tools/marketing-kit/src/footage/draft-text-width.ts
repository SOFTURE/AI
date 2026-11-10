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
  advances: (glyph: number) => number;
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
  const count = readUint16(hhea, 34);
  if (unitsPerSize <= 0 || count === 0 || hmtx.length < count * 4) return null;
  // Glyphs past `numberOfHMetrics` share the last advance (OpenType `hmtx`).
  return { unitsPerSize, advances: (glyph) => readUint16(hmtx, Math.min(glyph, count - 1) * 4) };
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
