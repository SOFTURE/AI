import { readCharacterMap } from "./character-map.js";
import { OutOfBounds, readFontTables, readInt32, readUint16, slice, type FontFileFormat, type FontTables } from "./font-tables.js";
import { OG_FONT_WEIGHTS } from "./fonts.js";
import { err, ok, type OgResult } from "./result.js";

/**
 * What an uploaded font file is and where the kit can use it, so an app stores it as a `BrandFont` file
 * (`family`, `files[{ path, weight, style }]`) and refuses it at upload with a reason instead of at render:
 * - `captions`: the film's captions, drawn by the browser render, which takes `.ttf`, `.otf`, `.woff` and `.woff2`;
 * - `draft`: the footage draft's captions, drawn by libass (FreeType), which reads `.ttf` and `.otf` and matches the
 *   family the file names itself;
 * - `cover`: OG images and the photo cover, drawn by Satori, which reads static `.ttf`, `.otf` and `.woff` files at
 *   weights 100-900 in steps of 100 (the rules `loadOgFonts` applies).
 */

export const FONT_USES = ["captions", "draft", "cover"] as const;

export type FontUse = (typeof FONT_USES)[number];

/** Why a file does not work for a use; a code, so an app words it in its own language. */
export type FontUnusableReason = "format" | "variable" | "weight" | "character-map" | "family-name";

export type FontUseVerdict = { isUsable: true } | { isUsable: false; reason: FontUnusableReason; detail: string };

export type FontFileWeight = { kind: "static"; value: number } | { kind: "variable"; min: number; max: number; default: number };

export interface FontFileInfo {
  /** The typographic family (name ID 16), else the family (name ID 1); null when the file names none. */
  family: string | null;
  format: FontFileFormat;
  weight: FontFileWeight;
  /** The weight as `BrandFont` files and CSS write it: `400`, or a variable range `100 900`. */
  cssWeight: string;
  style: "normal" | "italic";
  usableFor: Record<FontUse, FontUseVerdict>;
}

const FAMILY_NAME_ID = 1;
const TYPOGRAPHIC_FAMILY_NAME_ID = 16;
/** `usWeightClass` when a file has no `OS/2` table: regular, as browsers assume. */
const DEFAULT_WEIGHT = 400;
const WEIGHT_AXIS = "wght";

const USABLE: FontUseVerdict = { isUsable: true };

function unusable(reason: FontUnusableReason, detail: string): FontUseVerdict {
  return { isUsable: false, reason, detail };
}

function decodeName(bytes: Buffer, platform: number): string {
  if (platform === 1) return bytes.toString("latin1");
  let text = "";
  for (let index = 0; index + 1 < bytes.length; index += 2) text += String.fromCharCode(bytes.readUInt16BE(index));
  return text;
}

/** A name record's text: the Windows Unicode record first, US English first among those, else the Macintosh one. */
function findName(table: Buffer, nameId: number): string | null {
  const count = readUint16(table, 2);
  const strings = readUint16(table, 4);
  let best: { rank: number; name: string } | null = null;
  for (let index = 0; index < count; index++) {
    const record = 6 + index * 12;
    const platform = readUint16(table, record);
    if (readUint16(table, record + 6) !== nameId || (platform !== 3 && platform !== 1)) continue;
    const language = readUint16(table, record + 4);
    const text = decodeName(slice(table, strings + readUint16(table, record + 10), readUint16(table, record + 8)), platform).trim();
    const rank = platform === 3 ? (language === 0x0409 ? 0 : 1) : 2;
    if (text.length > 0 && (best === null || rank < best.rank)) best = { rank, name: text };
  }
  return best?.name ?? null;
}

function readFamily(tables: FontTables): string | null {
  const table = tables.get("name");
  if (table === undefined) return null;
  return findName(table, TYPOGRAPHIC_FAMILY_NAME_ID) ?? findName(table, FAMILY_NAME_ID);
}

/** A 16.16 fixed-point number, rounded to a whole weight. */
function readFixedWeight(table: Buffer, offset: number): number {
  return Math.round(readInt32(table, offset) / 65536);
}

function readWeight(tables: FontTables): FontFileWeight {
  const fvar = tables.get("fvar");
  if (fvar !== undefined) {
    const axesOffset = readUint16(fvar, 4);
    const axisCount = readUint16(fvar, 8);
    const axisSize = readUint16(fvar, 10);
    for (let index = 0; index < axisCount; index++) {
      const axis = axesOffset + index * axisSize;
      if (slice(fvar, axis, 4).toString("latin1") !== WEIGHT_AXIS) continue;
      return { kind: "variable", min: readFixedWeight(fvar, axis + 4), default: readFixedWeight(fvar, axis + 8), max: readFixedWeight(fvar, axis + 12) };
    }
  }
  const os2 = tables.get("OS/2");
  return { kind: "static", value: os2 === undefined ? DEFAULT_WEIGHT : readUint16(os2, 4) };
}

function readStyle(tables: FontTables): "normal" | "italic" {
  const os2 = tables.get("OS/2");
  if (os2 !== undefined && (readUint16(os2, 62) & 0x1) !== 0) return "italic";
  const head = tables.get("head");
  if (head !== undefined && (readUint16(head, 44) & 0x2) !== 0) return "italic";
  return "normal";
}

function toCssWeight(weight: FontFileWeight): string {
  return weight.kind === "static" ? String(weight.value) : `${weight.min} ${weight.max}`;
}

function judgeDraft(format: FontFileFormat, family: string | null): FontUseVerdict {
  if (format !== "ttf" && format !== "otf") return unusable("format", `the footage draft (libass) reads .ttf and .otf files, not .${format}`);
  // libass matches the family of name ID 1; a file that names a typographic family names a family too in practice.
  return family === null ? unusable("family-name", "the font names no family, so the footage draft cannot match it") : USABLE;
}

function judgeCover(data: Buffer, format: FontFileFormat, weight: FontFileWeight): FontUseVerdict {
  if (format === "woff2") return unusable("format", "OG images (Satori) read .ttf, .otf and .woff files, not .woff2");
  if (weight.kind === "variable") return unusable("variable", `OG images (Satori) need a static file, and this one is variable (${weight.min}-${weight.max})`);
  if (!OG_FONT_WEIGHTS.some((ogWeight) => ogWeight === weight.value)) {
    return unusable("weight", `OG images (Satori) need a weight from 100 to 900 in steps of 100, and this file is ${weight.value}`);
  }
  const characters = readCharacterMap(data);
  return characters.ok ? USABLE : unusable("character-map", `OG images (Satori) cannot read its character map: ${characters.error}`);
}

/**
 * Reads an uploaded font file's family, weight, style and format, and whether captions, the footage draft and OG images
 * (the photo cover included) can use it. A broken or unknown file is an error value, never an exception.
 */
export function readFontFileInfo(data: Buffer): OgResult<FontFileInfo> {
  const tables = readFontTables(data);
  if (!tables.ok) return err(`Reading the font file: ${tables.error}.`);
  try {
    const { format } = tables.value;
    const family = readFamily(tables.value);
    const weight = readWeight(tables.value);
    return ok({
      family,
      format,
      weight,
      cssWeight: toCssWeight(weight),
      style: readStyle(tables.value),
      usableFor: { captions: USABLE, draft: judgeDraft(format, family), cover: judgeCover(data, format, weight) },
    });
  } catch (error) {
    if (error instanceof OutOfBounds) return err("Reading the font file: a table of the font is truncated or malformed.");
    throw error;
  }
}

/** Characters that need no glyph: whitespace, control and format characters, variation selectors. */
const INVISIBLE_PATTERN = /^[\p{White_Space}\p{Cc}\p{Cf}\u{FE00}-\u{FE0F}\u{E0100}-\u{E01EF}]$/u;

/**
 * The characters of `characters` the font file maps to no glyph, unique and in order (whitespace and other invisible
 * characters are skipped), e.g. the Polish letters an app requires of a brand font. An error value when the file's
 * character map cannot be read.
 */
export function findMissingCharacters(data: Buffer, characters: string): OgResult<string[]> {
  const map = readCharacterMap(data);
  if (!map.ok) return err(`Checking the font file's characters: ${map.error}.`);
  const missing: string[] = [];
  for (const character of characters) {
    if (INVISIBLE_PATTERN.test(character) || missing.includes(character)) continue;
    const codePoint = character.codePointAt(0);
    if (codePoint !== undefined && !map.value.has(codePoint)) missing.push(character);
  }
  return ok(missing);
}
