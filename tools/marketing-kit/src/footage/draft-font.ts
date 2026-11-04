import { readFileSync } from "node:fs";

import type { BrandFont, FontFile } from "../config/config.js";
import { err, ok, type TtsResult } from "../voice/provider.js";

/**
 * The font file a footage draft's captions are drawn with. libass (ffmpeg's `ass` filter) loads the files in the
 * draft's `fonts/` folder and matches a style's font name against the family each file names in its own `name` table,
 * not against the CSS family a brand config gives it, so the draft reads that name from the file. FreeType reads
 * TrueType and OpenType files; a brand font shipped only as WOFF or WOFF2 is not used.
 */

const SFNT_SIGNATURES = new Set([0x00010000, 0x74727565 /* true */, 0x4f54544f /* OTTO */]);
const NAME_TAG = 0x6e616d65; // name
const FAMILY_NAME_ID = 1;
/** The caption weight of the render's CSS (`getCaptionPillCss`, `.phrase`). */
const CAPTION_WEIGHT = 650;

class OutOfBounds extends Error {}

function readUint16(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > data.length) throw new OutOfBounds();
  return data.readUInt16BE(offset);
}

function readUint32(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > data.length) throw new OutOfBounds();
  return data.readUInt32BE(offset);
}

function decodeName(bytes: Buffer, platform: number): string {
  if (platform === 1) return bytes.toString("latin1");
  let text = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) text += String.fromCharCode(bytes.readUInt16BE(index));
  return text;
}

function findNameTable(data: Buffer): number | null {
  const count = readUint16(data, 4);
  for (let index = 0; index < count; index++) {
    const record = 12 + index * 16;
    if (readUint32(data, record) === NAME_TAG) return readUint32(data, record + 8);
  }
  return null;
}

/**
 * The family a TrueType or OpenType file names itself (name ID 1): the Windows Unicode record first, US English
 * first among those, else the Macintosh Roman one. An error value for WOFF, WOFF2, a collection or a broken file.
 */
export function readFontFamilyName(data: Buffer): TtsResult<string> {
  try {
    if (!SFNT_SIGNATURES.has(readUint32(data, 0))) return err("the file is not a TrueType or OpenType font");
    const table = findNameTable(data);
    if (table === null) return err("the font has no name table");
    const count = readUint16(data, table + 2);
    const strings = table + readUint16(data, table + 4);
    let best: { rank: number; name: string } | null = null;
    for (let index = 0; index < count; index++) {
      const record = table + 6 + index * 12;
      const platform = readUint16(data, record);
      const language = readUint16(data, record + 4);
      if (readUint16(data, record + 6) !== FAMILY_NAME_ID || (platform !== 3 && platform !== 1)) continue;
      const length = readUint16(data, record + 8);
      const start = strings + readUint16(data, record + 10);
      if (start + length > data.length) throw new OutOfBounds();
      const rank = platform === 3 ? (language === 0x0409 ? 0 : 1) : 2;
      const name = decodeName(data.subarray(start, start + length), platform).trim();
      if (name.length > 0 && (best === null || rank < best.rank)) best = { rank, name };
    }
    return best === null ? err("the font names no family") : ok(best.name);
  } catch (error) {
    if (error instanceof OutOfBounds) return err("the font file is cut short");
    throw error;
  }
}

/** How far a file's weight (`400`, or a variable range `100 900`) is from the caption weight; 0 inside a range. */
function getWeightDistance(file: FontFile): number {
  const [low, high] = file.weight.split(/\s+/).map(Number);
  if (low === undefined || Number.isNaN(low)) return Number.POSITIVE_INFINITY;
  const top = high === undefined || Number.isNaN(high) ? low : high;
  if (CAPTION_WEIGHT >= low && CAPTION_WEIGHT <= top) return 0;
  return Math.min(Math.abs(CAPTION_WEIGHT - low), Math.abs(CAPTION_WEIGHT - top));
}

/** The font file the draft draws captions with, and the family libass knows it by. */
export interface FootageDraftFontChoice {
  file: string;
  family: string;
}

/**
 * The body font's file closest to the render's caption weight (normal style first) that libass can read, with its own
 * family name; null when the brand has no body font or none of its files is a readable TrueType or OpenType font.
 */
export function chooseFootageDraftFont(font: BrandFont | null, read: (path: string) => Buffer = readFileSync): FootageDraftFontChoice | null {
  if (font === null) return null;
  const files = [...font.files].sort((a, b) => Number(a.style === "italic") - Number(b.style === "italic") || getWeightDistance(a) - getWeightDistance(b));
  for (const file of files) {
    const family = readFontFamilyName(read(file.path));
    if (family.ok) return { file: file.path, family: family.value };
  }
  return null;
}
