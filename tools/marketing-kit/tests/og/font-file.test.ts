import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { brotliCompressSync } from "node:zlib";

import { describe, expect, it } from "vitest";

import { FONT_USES, findMissingCharacters, readFontFileInfo, type FontFileInfo } from "../../src/og/index.js";
import { readFontTables } from "../../src/og/font-tables.js";
import { POLISH_LATIN1_LETTERS, POLISH_LETTERS } from "./pl/letters.js";

const require = createRequire(import.meta.url);

function readInter(subset: "latin" | "latin-ext", weight: 400 | 700, style: "normal" | "italic", format: "woff" | "woff2"): Buffer {
  return readFileSync(require.resolve(`@fontsource/inter/files/inter-${subset}-${weight}-${style}.${format}`));
}

const DEJAVU_BOLD = readFileSync(join(import.meta.dirname, "..", "..", "fonts", "DejaVuSans-Bold-Latin.ttf"));


/** An sfnt with the given tables, in tag order as the spec asks. */
function buildSfnt(tables: Record<string, Buffer>, signature = 0x00010000): Buffer {
  const tags = Object.keys(tables).sort();
  const header = Buffer.alloc(12 + tags.length * 16);
  header.writeUInt32BE(signature, 0);
  header.writeUInt16BE(tags.length, 4);
  let offset = header.length;
  const bodies: Buffer[] = [];
  tags.forEach((tag, index) => {
    const body = tables[tag] as Buffer;
    const record = 12 + index * 16;
    header.write(tag, record, "latin1");
    header.writeUInt32BE(offset, record + 8);
    header.writeUInt32BE(body.length, record + 12);
    bodies.push(body);
    offset += body.length;
  });
  return Buffer.concat([header, ...bodies]);
}

/** A `name` table with one Windows US English record per name ID. */
function buildName(names: Record<number, string>): Buffer {
  const entries = Object.entries(names).map(([id, text]) => ({ id: Number(id), bytes: Buffer.from(text, "utf16le").swap16() }));
  const headerSize = 6 + entries.length * 12;
  const table = Buffer.alloc(headerSize + entries.reduce((sum, entry) => sum + entry.bytes.length, 0));
  table.writeUInt16BE(entries.length, 2);
  table.writeUInt16BE(headerSize, 4);
  let offset = 0;
  entries.forEach((entry, index) => {
    const record = 6 + index * 12;
    table.writeUInt16BE(3, record);
    table.writeUInt16BE(1, record + 2);
    table.writeUInt16BE(0x0409, record + 4);
    table.writeUInt16BE(entry.id, record + 6);
    table.writeUInt16BE(entry.bytes.length, record + 8);
    table.writeUInt16BE(offset, record + 10);
    entry.bytes.copy(table, headerSize + offset);
    offset += entry.bytes.length;
  });
  return table;
}

/** An `OS/2` table with a weight class and the italic bit. */
function buildOs2(weight: number, isItalic = false): Buffer {
  const table = Buffer.alloc(78);
  table.writeUInt16BE(weight, 4);
  table.writeUInt16BE(isItalic ? 0x1 : 0x40, 62);
  return table;
}

/** An `fvar` table with one axis per entry, 16.16 fixed values. */
function buildFvar(axes: { tag: string; min: number; default: number; max: number }[]): Buffer {
  const table = Buffer.alloc(16 + axes.length * 20);
  table.writeUInt16BE(1, 0);
  table.writeUInt16BE(16, 4);
  table.writeUInt16BE(2, 6);
  table.writeUInt16BE(axes.length, 8);
  table.writeUInt16BE(20, 10);
  axes.forEach((axis, index) => {
    const at = 16 + index * 20;
    table.write(axis.tag, at, "latin1");
    table.writeInt32BE(axis.min * 65536, at + 4);
    table.writeInt32BE(axis.default * 65536, at + 8);
    table.writeInt32BE(axis.max * 65536, at + 12);
  });
  return table;
}

/** A WOFF2 UIntBase128: seven bits per byte, most significant first, the high bit on all but the last. */
function encodeBase128(value: number): Buffer {
  const bytes = [value & 0x7f];
  for (let rest = value >>> 7; rest > 0; rest >>>= 7) bytes.unshift(0x80 | (rest & 0x7f));
  return Buffer.from(bytes);
}

/** A WOFF2 file of the given tables (null transforms only), one of them under a tag the known-table list lacks. */
function buildWoff2(tables: { tag: string; body: Buffer }[]): Buffer {
  const known: Record<string, number> = { name: 5, "OS/2": 6, fvar: 47 };
  const directory = Buffer.concat(
    tables.map(({ tag, body }) => {
      const index = known[tag];
      const length = encodeBase128(body.length);
      return index === undefined ? Buffer.concat([Buffer.from([0x3f]), Buffer.from(tag, "latin1"), length]) : Buffer.concat([Buffer.from([index]), length]);
    }),
  );
  const compressed = brotliCompressSync(Buffer.concat(tables.map(({ body }) => body)));
  const header = Buffer.alloc(48);
  header.write("wOF2", 0, "latin1");
  header.writeUInt32BE(0x00010000, 4);
  header.writeUInt16BE(tables.length, 12);
  header.writeUInt32BE(compressed.length, 20);
  return Buffer.concat([header, directory, compressed]);
}

function expectInfo(data: Buffer): FontFileInfo {
  const info = readFontFileInfo(data);
  if (!info.ok) throw new Error(`expected the font to read: ${info.error}`);
  return info.value;
}

describe("readFontFileInfo", () => {
  it("reads a static TrueType file, usable everywhere", () => {
    expect(expectInfo(DEJAVU_BOLD)).toEqual({
      family: "DejaVu Sans",
      format: "ttf",
      weight: { kind: "static", value: 700 },
      cssWeight: "700",
      style: "normal",
      usableFor: { captions: { isUsable: true }, draft: { isUsable: true }, cover: { isUsable: true } },
    });
  });

  it("reads a WOFF file: captions and the cover, not the draft", () => {
    const info = expectInfo(readInter("latin", 400, "normal", "woff"));
    expect([info.family, info.format, info.cssWeight, info.style]).toEqual(["Inter", "woff", "400", "normal"]);
    expect(info.usableFor).toEqual({
      captions: { isUsable: true },
      draft: { isUsable: false, reason: "format", detail: "the footage draft (libass) reads .ttf and .otf files, not .woff" },
      cover: { isUsable: true },
    });
  });

  it("reads a WOFF2 file's weight and italic style, and says the cover cannot use it", () => {
    const info = expectInfo(readInter("latin", 700, "italic", "woff2"));
    expect([info.family, info.format, info.weight, info.style]).toEqual(["Inter", "woff2", { kind: "static", value: 700 }, "italic"]);
    expect(info.usableFor.captions).toEqual({ isUsable: true });
    expect(info.usableFor.cover).toEqual({ isUsable: false, reason: "format", detail: "OG images (Satori) read .ttf, .otf and .woff files, not .woff2" });
    expect(info.usableFor.draft).toMatchObject({ isUsable: false, reason: "format" });
  });

  it("reads the same facts from the WOFF and WOFF2 files of one font", () => {
    const woff = expectInfo(readInter("latin-ext", 400, "italic", "woff"));
    const woff2 = expectInfo(readInter("latin-ext", 400, "italic", "woff2"));
    expect([woff2.family, woff2.weight, woff2.style]).toEqual([woff.family, woff.weight, woff.style]);
  });

  it("reads a variable weight range: captions only, the draft, not the cover", () => {
    const font = buildSfnt({
      name: buildName({ 1: "Brand Sans Thin", 16: "Brand Sans" }),
      "OS/2": buildOs2(100),
      fvar: buildFvar([
        { tag: "opsz", min: 14, default: 14, max: 32 },
        { tag: "wght", min: 100, default: 400, max: 900 },
      ]),
    });
    const info = expectInfo(font);
    expect([info.family, info.weight, info.cssWeight]).toEqual(["Brand Sans", { kind: "variable", min: 100, default: 400, max: 900 }, "100 900"]);
    expect(info.usableFor).toEqual({
      captions: { isUsable: true },
      draft: { isUsable: true },
      cover: { isUsable: false, reason: "variable", detail: "OG images (Satori) need a static file, and this one is variable (100-900)" },
    });
  });

  it("reads a WOFF2 file with a table the known-table list lacks", () => {
    const font = buildWoff2([
      { tag: "name", body: buildName({ 1: "Brand Serif" }) },
      { tag: "OS/2", body: buildOs2(300, true) },
      { tag: "zzzz", body: Buffer.alloc(200) },
      { tag: "fvar", body: buildFvar([{ tag: "wght", min: 300, default: 300, max: 700 }]) },
    ]);
    expect(readFontTables(font)).toMatchObject({ ok: true, value: { format: "woff2", flavor: "ttf" } });
    const info = expectInfo(font);
    expect([info.family, info.cssWeight, info.style]).toEqual(["Brand Serif", "300 700", "italic"]);
  });

  it("refuses a weight between the hundreds for the cover", () => {
    const info = expectInfo(buildSfnt({ name: buildName({ 1: "Odd" }), "OS/2": buildOs2(350) }));
    expect(info.usableFor.cover).toEqual({ isUsable: false, reason: "weight", detail: "OG images (Satori) need a weight from 100 to 900 in steps of 100, and this file is 350" });
  });

  it("says when the draft cannot match a file that names no family, or the cover cannot read its characters", () => {
    const info = expectInfo(buildSfnt({ "OS/2": buildOs2(400) }));
    expect(info.family).toBeNull();
    expect(info.usableFor.draft).toEqual({ isUsable: false, reason: "family-name", detail: "the font names no family, so the footage draft cannot match it" });
    expect(info.usableFor.cover).toEqual({ isUsable: false, reason: "character-map", detail: "OG images (Satori) cannot read its character map: the font has no cmap table" });
  });

  it("answers every use", () => {
    expect(Object.keys(expectInfo(DEJAVU_BOLD).usableFor)).toEqual([...FONT_USES]);
  });

  it("returns an error value for a broken file, never an exception", () => {
    const woff2 = readInter("latin", 400, "normal", "woff2");
    const corrupt = Buffer.from(woff2);
    corrupt.fill(0xff, 200, 260);
    const shortName = buildSfnt({ name: buildName({ 1: "Cut" }).subarray(0, 10) });
    expect([
      readFontFileInfo(Buffer.from("not a font")),
      readFontFileInfo(Buffer.alloc(0)),
      readFontFileInfo(woff2.subarray(0, 120)),
      readFontFileInfo(corrupt),
      readFontFileInfo(buildSfnt({}, 0x74746366)),
      readFontFileInfo(shortName),
    ]).toEqual([
      { ok: false, error: "Reading the font file: the file is not a TrueType, OpenType, WOFF or WOFF2 font." },
      { ok: false, error: "Reading the font file: the font file is truncated or malformed." },
      { ok: false, error: "Reading the font file: the font file is truncated or malformed." },
      { ok: false, error: "Reading the font file: the WOFF2 font data does not decompress." },
      { ok: false, error: "Reading the font file: font collections are not read." },
      { ok: false, error: "Reading the font file: a table of the font is truncated or malformed." },
    ]);
  });

  it("refuses an absurd table count before reading any table", () => {
    const font = Buffer.alloc(12);
    font.writeUInt32BE(0x00010000, 0);
    font.writeUInt16BE(0xffff, 4);
    expect(readFontFileInfo(font)).toEqual({ ok: false, error: "Reading the font file: the font lists 65535 tables." });
  });
});

describe("findMissingCharacters", () => {
  it("lists the Polish letters a latin subset lacks, unique and in order, skipping whitespace", () => {
    expect(findMissingCharacters(readInter("latin", 400, "normal", "woff2"), `Aa ${POLISH_LETTERS}${POLISH_LETTERS}`)).toEqual({
      ok: true,
      value: [...POLISH_LETTERS].filter((letter) => !POLISH_LATIN1_LETTERS.includes(letter)),
    });
  });

  it("lists only the letters a latin-ext subset leaves to the latin one", () => {
    expect(findMissingCharacters(readInter("latin-ext", 400, "normal", "woff"), POLISH_LETTERS)).toEqual({ ok: true, value: POLISH_LATIN1_LETTERS });
  });

  it("returns an error value for a file without a character map", () => {
    expect(findMissingCharacters(Buffer.from("not a font"), "a")).toEqual({
      ok: false,
      error: "Checking the font file's characters: the file is not a TrueType, OpenType, WOFF or WOFF2 font.",
    });
  });
});
