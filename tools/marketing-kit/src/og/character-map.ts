import { inflateSync } from "node:zlib";

import { err, ok, type OgResult } from "./result.js";

/**
 * The characters a font file maps to a glyph, read from its `cmap` table the way Satori's font
 * parser (opentype.js) reads it: the last Unicode subtable of the table (platform 0 encodings 0-4,
 * platform 3 encodings 0, 1 and 10), in format 4 or 12. Glyph 0 (`.notdef`) means "not in the font".
 * Every read is bounds-checked, so a broken file is an error value, never an exception.
 */
export interface CharacterMap {
  has(codePoint: number): boolean;
}

const SFNT_SIGNATURES = new Set([0x00010000, 0x74727565 /* true */, 0x4f54544f /* OTTO */]);
const WOFF_SIGNATURE = 0x774f4646; // wOFF
const WOFF2_SIGNATURE = 0x774f4632; // wOF2
const COLLECTION_SIGNATURE = 0x74746366; // ttcf

class OutOfBounds extends Error {}

function readUint16(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > data.length) throw new OutOfBounds();
  return data.readUInt16BE(offset);
}

function readInt16(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > data.length) throw new OutOfBounds();
  return data.readInt16BE(offset);
}

function readUint32(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > data.length) throw new OutOfBounds();
  return data.readUInt32BE(offset);
}

function slice(data: Buffer, offset: number, length: number): Buffer {
  if (offset < 0 || length < 0 || offset + length > data.length) throw new OutOfBounds();
  return data.subarray(offset, offset + length);
}

const CMAP_TAG = 0x636d6170; // cmap

/** The raw `cmap` table of an sfnt (`.ttf`, `.otf`) or WOFF file, or a reason it has none. */
function findCmapTable(data: Buffer): OgResult<Buffer> {
  const signature = readUint32(data, 0);
  if (SFNT_SIGNATURES.has(signature)) {
    const count = readUint16(data, 4);
    for (let index = 0; index < count; index++) {
      const record = 12 + index * 16;
      if (readUint32(data, record) === CMAP_TAG) return ok(slice(data, readUint32(data, record + 8), readUint32(data, record + 12)));
    }
    return err("the font has no cmap table");
  }
  if (signature === WOFF_SIGNATURE) {
    const count = readUint16(data, 12);
    for (let index = 0; index < count; index++) {
      const entry = 44 + index * 20;
      if (readUint32(data, entry) !== CMAP_TAG) continue;
      const stored = slice(data, readUint32(data, entry + 4), readUint32(data, entry + 8));
      const length = readUint32(data, entry + 12);
      if (stored.length >= length) return ok(stored);
      try {
        return ok(inflateSync(stored));
      } catch {
        return err("the font's cmap table does not decompress");
      }
    }
    return err("the font has no cmap table");
  }
  if (signature === WOFF2_SIGNATURE) return err("WOFF2 is not read");
  if (signature === COLLECTION_SIGNATURE) return err("font collections are not read");
  return err("the file is not a TrueType, OpenType or WOFF font");
}

function isUnicodeEncoding(platform: number, encoding: number): boolean {
  return (platform === 3 && (encoding === 0 || encoding === 1 || encoding === 10)) || (platform === 0 && encoding <= 4);
}

/**
 * Format 4: segments of 16-bit code points; the last segment (0xFFFF) is skipped, as opentype.js does.
 * The glyph is looked up on demand, so a hostile segment count costs nothing up front.
 */
function getFormat4Glyph(table: Buffer, start: number, codePoint: number): number {
  const segments = readUint16(table, start + 6) >> 1;
  for (let segment = 0; segment < segments - 1; segment++) {
    const end = readUint16(table, start + 14 + segment * 2);
    if (codePoint > end) continue;
    const first = readUint16(table, start + 16 + segments * 2 + segment * 2);
    if (codePoint < first) return 0;
    const delta = readInt16(table, start + 16 + segments * 4 + segment * 2);
    const rangeOffsetAt = start + 16 + segments * 6 + segment * 2;
    const rangeOffset = readUint16(table, rangeOffsetAt);
    if (rangeOffset === 0) return (codePoint + delta) & 0xffff;
    const glyph = readUint16(table, rangeOffsetAt + rangeOffset + (codePoint - first) * 2);
    return glyph === 0 ? 0 : (glyph + delta) & 0xffff;
  }
  return 0;
}

/** Format 12: groups of code points mapped to consecutive glyphs. */
function getFormat12Glyph(table: Buffer, start: number, codePoint: number): number {
  const groups = readUint32(table, start + 12);
  for (let group = 0; group < groups; group++) {
    const at = start + 16 + group * 12;
    const first = readUint32(table, at);
    if (codePoint >= first && codePoint <= readUint32(table, at + 4)) return readUint32(table, at + 8) + codePoint - first;
  }
  return 0;
}

function readCmap(table: Buffer): OgResult<CharacterMap> {
  if (readUint16(table, 0) !== 0) return err("the font's cmap table has an unknown version");
  let start = -1;
  for (let index = readUint16(table, 2) - 1; index >= 0; index--) {
    const record = 4 + index * 8;
    if (isUnicodeEncoding(readUint16(table, record), readUint16(table, record + 2))) {
      start = readUint32(table, record + 4);
      break;
    }
  }
  if (start === -1) return err("the font maps no Unicode characters");
  const format = readUint16(table, start);
  if (format !== 4 && format !== 12) return err(`the font's character map has format ${format}; Satori reads formats 4 and 12`);
  const getGlyph = format === 4 ? getFormat4Glyph : getFormat12Glyph;
  return ok({
    has(codePoint) {
      try {
        return getGlyph(table, start, codePoint) !== 0;
      } catch (error) {
        if (error instanceof OutOfBounds) return false;
        throw error;
      }
    },
  });
}

/** Reads a font file's character map; the error says why it cannot be read. */
export function readCharacterMap(data: Buffer): OgResult<CharacterMap> {
  try {
    const table = findCmapTable(data);
    return table.ok ? readCmap(table.value) : table;
  } catch (error) {
    if (error instanceof OutOfBounds) return err("the font file is truncated or malformed");
    throw error;
  }
}

const cache = new WeakMap<Buffer, OgResult<CharacterMap>>();

/** `readCharacterMap`, once per font buffer: a route renders many cards with the same fonts. */
export function loadCharacterMap(data: Buffer): OgResult<CharacterMap> {
  const cached = cache.get(data);
  if (cached !== undefined) return cached;
  const result = readCharacterMap(data);
  cache.set(data, result);
  return result;
}
