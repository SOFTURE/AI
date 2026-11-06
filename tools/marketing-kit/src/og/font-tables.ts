import { brotliDecompressSync, inflateSync } from "node:zlib";

import { err, ok, type OgResult } from "./result.js";

/**
 * The tables of a font file, by tag, for the formats an app may upload: TrueType and OpenType (sfnt), WOFF (each table
 * zlib-compressed on its own) and WOFF2 (all tables in one Brotli stream). WOFF2 may transform `glyf`, `loca` and
 * `hmtx`; those come back as stored, which is fine for the tables read here (`cmap`, `name`, `OS/2`, `head`, `fvar`
 * are never transformed). Every read is bounds-checked, so a broken file is an error value, never an exception.
 */

export type FontFileFormat = "ttf" | "otf" | "woff" | "woff2";

export interface FontTables {
  format: FontFileFormat;
  /** The format of the font inside a WOFF or WOFF2 wrapper (`ttf` or `otf`); the format itself for an sfnt. */
  flavor: "ttf" | "otf";
  get(tag: string): Buffer | undefined;
}

const TRUETYPE_SIGNATURES = new Set([0x00010000, 0x74727565 /* true */]);
const OPENTYPE_SIGNATURE = 0x4f54544f; // OTTO
const WOFF_SIGNATURE = 0x774f4646; // wOFF
const WOFF2_SIGNATURE = 0x774f4632; // wOF2
const COLLECTION_SIGNATURE = 0x74746366; // ttcf

/** More tables than any real font has; a larger count is a broken or hostile file. */
const MAX_TABLES = 512;
/** The largest decompressed WOFF2 font read (a CJK font is about 20 MB). */
const MAX_WOFF2_SIZE = 64 * 1024 * 1024;

/** The WOFF2 known-table tags, by their 6-bit index (WOFF2 spec, 5.1). */
const WOFF2_KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG",
  "EBDT", "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC",
  "JSTF", "MATH", "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc",
  "feat", "fmtx", "fvar", "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat",
  "Gloc", "Feat", "Sill",
];

export class OutOfBounds extends Error {}

export function readUint8(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 1 > data.length) throw new OutOfBounds();
  return data.readUInt8(offset);
}

export function readUint16(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > data.length) throw new OutOfBounds();
  return data.readUInt16BE(offset);
}

export function readInt16(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 2 > data.length) throw new OutOfBounds();
  return data.readInt16BE(offset);
}

export function readUint32(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > data.length) throw new OutOfBounds();
  return data.readUInt32BE(offset);
}

export function readInt32(data: Buffer, offset: number): number {
  if (offset < 0 || offset + 4 > data.length) throw new OutOfBounds();
  return data.readInt32BE(offset);
}

export function slice(data: Buffer, offset: number, length: number): Buffer {
  if (offset < 0 || length < 0 || offset + length > data.length) throw new OutOfBounds();
  return data.subarray(offset, offset + length);
}

function readTag(data: Buffer, offset: number): string {
  return slice(data, offset, 4).toString("latin1");
}

function toTables(format: FontFileFormat, flavor: "ttf" | "otf", tables: Map<string, Buffer>): FontTables {
  return { format, flavor, get: (tag) => tables.get(tag) };
}

function getFlavor(signature: number): "ttf" | "otf" | null {
  if (TRUETYPE_SIGNATURES.has(signature)) return "ttf";
  if (signature === OPENTYPE_SIGNATURE) return "otf";
  return null;
}

function readTableCount(data: Buffer, offset: number): OgResult<number> {
  const count = readUint16(data, offset);
  return count > MAX_TABLES ? err(`the font lists ${count} tables`) : ok(count);
}

function readSfnt(data: Buffer, flavor: "ttf" | "otf"): OgResult<FontTables> {
  const count = readTableCount(data, 4);
  if (!count.ok) return count;
  const tables = new Map<string, Buffer>();
  for (let index = 0; index < count.value; index++) {
    const record = 12 + index * 16;
    tables.set(readTag(data, record), slice(data, readUint32(data, record + 8), readUint32(data, record + 12)));
  }
  return ok(toTables(flavor, flavor, tables));
}

function readWoff(data: Buffer): OgResult<FontTables> {
  const flavor = getFlavor(readUint32(data, 4));
  if (flavor === null) return err("the WOFF file wraps neither a TrueType nor an OpenType font");
  const count = readTableCount(data, 12);
  if (!count.ok) return count;
  const tables = new Map<string, Buffer>();
  for (let index = 0; index < count.value; index++) {
    const entry = 44 + index * 20;
    const tag = readTag(data, entry);
    const stored = slice(data, readUint32(data, entry + 4), readUint32(data, entry + 8));
    const length = readUint32(data, entry + 12);
    if (stored.length >= length) {
      tables.set(tag, stored);
      continue;
    }
    try {
      tables.set(tag, inflateSync(stored, { maxOutputLength: Math.max(length, 1) }));
    } catch {
      return err(`the font's ${tag.trim()} table does not decompress`);
    }
  }
  return ok(toTables("woff", flavor, tables));
}

/** A WOFF2 UIntBase128 at `offset`: the value and the offset after it, or null when it is malformed. */
function readBase128(data: Buffer, offset: number): { value: number; next: number } | null {
  let value = 0;
  for (let index = 0; index < 5; index++) {
    const byte = readUint8(data, offset + index);
    if (index === 0 && byte === 0x80) return null;
    if (value > 0x01ffffff) return null;
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return { value, next: offset + index + 1 };
  }
  return null;
}

interface Woff2Entry {
  tag: string;
  length: number;
}

function readWoff2Directory(data: Buffer, count: number): OgResult<{ entries: Woff2Entry[]; end: number }> {
  const entries: Woff2Entry[] = [];
  let offset = 48;
  for (let index = 0; index < count; index++) {
    const flags = readUint8(data, offset);
    offset += 1;
    const known = flags & 0x3f;
    let tag: string;
    if (known === 0x3f) {
      tag = readTag(data, offset);
      offset += 4;
    } else {
      const name = WOFF2_KNOWN_TAGS[known];
      if (name === undefined) return err(`the WOFF2 table directory names an unknown table index ${known}`);
      tag = name;
    }
    const original = readBase128(data, offset);
    if (original === null) return err("the WOFF2 table directory is malformed");
    offset = original.next;
    const version = flags >> 6;
    const isTransformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    let length = original.value;
    if (isTransformed) {
      const transformed = readBase128(data, offset);
      if (transformed === null) return err("the WOFF2 table directory is malformed");
      offset = transformed.next;
      length = transformed.value;
    }
    entries.push({ tag, length });
  }
  return ok({ entries, end: offset });
}

function readWoff2(data: Buffer): OgResult<FontTables> {
  const flavorSignature = readUint32(data, 4);
  if (flavorSignature === COLLECTION_SIGNATURE) return err("font collections are not read");
  const flavor = getFlavor(flavorSignature);
  if (flavor === null) return err("the WOFF2 file wraps neither a TrueType nor an OpenType font");
  const count = readTableCount(data, 12);
  if (!count.ok) return count;
  const totalSfntSize = readUint32(data, 16);
  const compressedSize = readUint32(data, 20);
  const directory = readWoff2Directory(data, count.value);
  if (!directory.ok) return directory;
  const compressed = slice(data, directory.value.end, compressedSize);
  const expected = directory.value.entries.reduce((sum, entry) => sum + entry.length, 0);
  if (expected > MAX_WOFF2_SIZE || totalSfntSize > MAX_WOFF2_SIZE) return err("the WOFF2 font is larger than 64 MB unpacked");
  let stream: Buffer;
  try {
    stream = brotliDecompressSync(compressed, { maxOutputLength: Math.max(expected, 1) });
  } catch {
    return err("the WOFF2 font data does not decompress");
  }
  const tables = new Map<string, Buffer>();
  let offset = 0;
  for (const entry of directory.value.entries) {
    tables.set(entry.tag, slice(stream, offset, entry.length));
    offset += entry.length;
  }
  return ok(toTables("woff2", flavor, tables));
}

/** Reads a font file's tables; the error says why it cannot be read. */
export function readFontTables(data: Buffer): OgResult<FontTables> {
  try {
    const signature = readUint32(data, 0);
    const flavor = getFlavor(signature);
    if (flavor !== null) return readSfnt(data, flavor);
    if (signature === WOFF_SIGNATURE) return readWoff(data);
    if (signature === WOFF2_SIGNATURE) return readWoff2(data);
    if (signature === COLLECTION_SIGNATURE) return err("font collections are not read");
    return err("the file is not a TrueType, OpenType, WOFF or WOFF2 font");
  } catch (error) {
    if (error instanceof OutOfBounds) return err("the font file is truncated or malformed");
    throw error;
  }
}
