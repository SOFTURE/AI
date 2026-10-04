import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

import { describe, expect, it } from "vitest";

import { loadCharacterMap, readCharacterMap } from "../../src/og/character-map.js";
import { h } from "../../src/og/element.js";
import { describeCharacter, findMissingGlyphs, parseFontFamily, selectSatoriFont } from "../../src/og/glyphs.js";
import type { SatoriFont } from "../../src/og/fonts.js";
import { getInterFile } from "./helpers.js";

const require = createRequire(import.meta.url);

// Polish letters as escapes: the repository's language gate keeps literal Polish out of code.
const A_OGONEK = "\u0105";
const E_OGONEK = "\u0119";
const L_STROKE = "\u0142";
const ROCKET = "\u{1F680}";

const LATIN = readFileSync(getInterFile(400));
const LATIN_BOLD = readFileSync(getInterFile(700));
const LATIN_EXT = readFileSync(require.resolve("@fontsource/inter/files/inter-latin-ext-400-normal.woff"));
const LATIN_EXT_BOLD = readFileSync(require.resolve("@fontsource/inter/files/inter-latin-ext-700-normal.woff"));

function font(data: Buffer, weight: SatoriFont["weight"], name = "Inter", style: SatoriFont["style"] = "normal"): SatoriFont {
  return { name, data, weight, style };
}

interface Subtable {
  platform: number;
  encoding: number;
  body: Buffer;
}

/** A cmap format 4 subtable: each segment maps `[start, end]` to `code + delta`; the 0xFFFF segment is added. */
function format4(segments: { start: number; end: number; delta: number }[]): Buffer {
  const all = [...segments, { start: 0xffff, end: 0xffff, delta: 1 }];
  const body = Buffer.alloc(16 + all.length * 8);
  body.writeUInt16BE(4, 0);
  body.writeUInt16BE(body.length, 2);
  body.writeUInt16BE(all.length * 2, 6);
  all.forEach((segment, index) => {
    body.writeUInt16BE(segment.end, 14 + index * 2);
    body.writeUInt16BE(segment.start, 16 + all.length * 2 + index * 2);
    body.writeInt16BE(segment.delta, 16 + all.length * 4 + index * 2);
  });
  return body;
}

/** A cmap format 12 subtable: each group maps `[start, end]` to consecutive glyphs from `glyph`. */
function format12(groups: { start: number; end: number; glyph: number }[]): Buffer {
  const body = Buffer.alloc(16 + groups.length * 12);
  body.writeUInt16BE(12, 0);
  body.writeUInt32BE(body.length, 4);
  body.writeUInt32BE(groups.length, 12);
  groups.forEach((group, index) => {
    body.writeUInt32BE(group.start, 16 + index * 12);
    body.writeUInt32BE(group.end, 20 + index * 12);
    body.writeUInt32BE(group.glyph, 24 + index * 12);
  });
  return body;
}

/** A TrueType file holding only a cmap table with the given subtables. */
function buildSfnt(subtables: Subtable[], tag = "cmap"): Buffer {
  const header = Buffer.alloc(4 + subtables.length * 8);
  header.writeUInt16BE(subtables.length, 2);
  let offset = header.length;
  subtables.forEach((subtable, index) => {
    header.writeUInt16BE(subtable.platform, 4 + index * 8);
    header.writeUInt16BE(subtable.encoding, 6 + index * 8);
    header.writeUInt32BE(offset, 8 + index * 8);
    offset += subtable.body.length;
  });
  const table = Buffer.concat([header, ...subtables.map((subtable) => subtable.body)]);
  const directory = Buffer.alloc(12 + 16);
  directory.writeUInt32BE(0x00010000, 0);
  directory.writeUInt16BE(1, 4);
  directory.write(tag, 12, "latin1");
  directory.writeUInt32BE(directory.length, 20);
  directory.writeUInt32BE(table.length, 24);
  return Buffer.concat([directory, table]);
}

function readHas(data: Buffer, characters: string[]): boolean[] {
  const map = readCharacterMap(data);
  if (!map.ok) throw new Error(map.error);
  return characters.map((character) => map.value.has(character.codePointAt(0) ?? 0));
}

describe("readCharacterMap", () => {
  it("reads a compressed WOFF cmap: the latin subset has no Polish letters", () => {
    expect(readHas(LATIN, ["A", "z", "$", A_OGONEK, L_STROKE])).toEqual([true, true, true, false, false]);
  });

  it("reads the latin-ext subset, which has them", () => {
    expect(readHas(LATIN_EXT, [A_OGONEK, E_OGONEK, L_STROKE])).toEqual([true, true, true]);
  });

  it("reads a TrueType format 4 subtable, glyph 0 counting as missing", () => {
    const data = buildSfnt([{ platform: 3, encoding: 1, body: format4([{ start: 0x41, end: 0x43, delta: -0x40 }, { start: 0x50, end: 0x50, delta: -0x50 }]) }]);
    expect(readHas(data, ["A", "C", "D", "P"])).toEqual([true, true, false, false]);
  });

  it("reads a format 12 subtable beyond the basic plane", () => {
    const data = buildSfnt([{ platform: 3, encoding: 10, body: format12([{ start: 0x1f680, end: 0x1f681, glyph: 5 }]) }]);
    expect(readHas(data, [ROCKET, "A"])).toEqual([true, false]);
  });

  it("uses the last Unicode subtable, as Satori's parser does", () => {
    const data = buildSfnt([
      { platform: 3, encoding: 1, body: format4([{ start: 0x41, end: 0x41, delta: 1 }]) },
      { platform: 3, encoding: 10, body: format12([{ start: 0x42, end: 0x42, glyph: 1 }]) },
    ]);
    expect(readHas(data, ["A", "B"])).toEqual([false, true]);
  });

  it("refuses files it cannot read, with the reason", () => {
    const mac = buildSfnt([{ platform: 1, encoding: 0, body: format4([]) }]);
    const format6 = Buffer.alloc(10);
    format6.writeUInt16BE(6, 0);
    expect([
      readCharacterMap(buildSfnt([], "glyf")),
      readCharacterMap(mac),
      readCharacterMap(buildSfnt([{ platform: 0, encoding: 3, body: format6 }])),
      readCharacterMap(LATIN.subarray(0, 60)),
      readCharacterMap(readFileSync(getInterFile(400, "woff2"))),
      readCharacterMap(Buffer.from("not a font")),
    ]).toEqual([
      { ok: false, error: "the font has no cmap table" },
      { ok: false, error: "the font maps no Unicode characters" },
      { ok: false, error: "the font's character map has format 6; Satori reads formats 4 and 12" },
      { ok: false, error: "the font file is truncated or malformed" },
      { ok: false, error: "WOFF2 is not read" },
      { ok: false, error: "the file is not a TrueType, OpenType or WOFF font" },
    ]);
  });

  it("reads each buffer once", () => {
    expect(loadCharacterMap(LATIN)).toBe(loadCharacterMap(LATIN));
  });
});

describe("selectSatoriFont", () => {
  const weights = (list: SatoriFont["weight"][]) => list.map((weight) => font(LATIN, weight));
  const pick = (list: SatoriFont["weight"][], weight: number) => selectSatoriFont(weights(list), { weight, style: "normal" })?.weight;

  it("takes the exact weight", () => {
    expect(pick([300, 400, 700], 700)).toBe(700);
  });

  it("lets 400 and 500 stand in for each other", () => {
    expect([pick([300, 500, 700], 400), pick([300, 400, 700], 500)]).toEqual([500, 400]);
  });

  it("prefers lighter weights below 400 and heavier ones above 500", () => {
    expect([pick([100, 200, 600], 300), pick([600, 900], 300), pick([300, 800], 600), pick([300, 400], 800)]).toEqual([200, 600, 800, 400]);
  });

  it("keeps the first file when two have the same weight and style", () => {
    const first = font(LATIN, 400);
    expect(selectSatoriFont([first, font(LATIN_EXT, 400)], { weight: 400, style: "normal" })).toBe(first);
  });

  it("breaks a weight tie by style only", () => {
    const upright = font(LATIN, 400);
    const italic = font(LATIN, 700, "Inter", "italic");
    expect(selectSatoriFont([font(LATIN, 400, "Inter", "italic"), upright], { weight: 400, style: "normal" })).toBe(upright);
    expect(selectSatoriFont([upright, italic], { weight: 700, style: "normal" })).toBe(italic);
  });
});

describe("findMissingGlyphs", () => {
  const card = (...texts: { family?: string; weight?: number; text: string }[]) =>
    h(
      "div",
      { style: { fontFamily: "Inter", fontWeight: 400 } },
      ...texts.map(({ family, weight, text }) => h("div", { style: { ...(family === undefined ? {} : { fontFamily: family }), ...(weight === undefined ? {} : { fontWeight: weight }) } }, text)),
    );

  it("lists each text's missing characters once, in order", () => {
    const tree = card({ text: `Zak${L_STROKE}ad ${A_OGONEK}${L_STROKE}` }, { text: "Fine" });
    expect(findMissingGlyphs(tree, [font(LATIN, 400)])).toEqual({ ok: true, value: [{ text: `Zak${L_STROKE}ad ${A_OGONEK}${L_STROKE}`, characters: [L_STROKE, A_OGONEK] }] });
  });

  it("lists a text drawn twice once", () => {
    const tree = card({ text: A_OGONEK }, { weight: 700, text: A_OGONEK });
    expect(findMissingGlyphs(tree, [font(LATIN, 400), font(LATIN_BOLD, 700)])).toEqual({ ok: true, value: [{ text: A_OGONEK, characters: [A_OGONEK] }] });
  });

  it("does not use a second file of the same family and weight, as Satori does not", () => {
    const tree = card({ text: A_OGONEK });
    expect(findMissingGlyphs(tree, [font(LATIN, 400), font(LATIN_EXT, 400)])).toEqual({ ok: true, value: [{ text: A_OGONEK, characters: [A_OGONEK] }] });
  });

  it("falls back to another family, at the weight Satori would pick there", () => {
    const tree = card({ weight: 700, text: `${A_OGONEK} bold` });
    expect(findMissingGlyphs(tree, [font(LATIN, 400), font(LATIN_BOLD, 700), font(LATIN_EXT, 400, "Inter Ext")])).toEqual({ ok: true, value: [] });
  });

  it("inherits the family from an ancestor and falls back from a family that is not loaded", () => {
    const tree = h("div", { style: { fontFamily: "Missing Face" } }, h("span", {}, A_OGONEK));
    expect(findMissingGlyphs(tree, [font(LATIN, 400), font(LATIN_EXT, 400, "Inter Ext")])).toEqual({ ok: true, value: [] });
  });

  it("skips whitespace, format characters and variation selectors, and checks emoji like any character", () => {
    const text = `a\u00a0b\n\u200dc\ufe0f ${ROCKET}`;
    const tree = card({ text });
    expect(findMissingGlyphs(tree, [font(LATIN, 400)])).toEqual({ ok: true, value: [{ text, characters: [ROCKET] }] });
  });

  it("draws from the subset families named after the family, at the text's weight", () => {
    const fonts = [font(LATIN, 400), font(LATIN_BOLD, 700), font(LATIN_EXT, 400, "Inter #2"), font(LATIN_EXT_BOLD, 700, "Inter #2")];
    const tree = card({ family: "Inter, Inter #2", text: `Zacznij ${A_OGONEK}` }, { family: "Inter, Inter #2", weight: 700, text: E_OGONEK });
    expect(findMissingGlyphs(tree, fonts)).toEqual({ ok: true, value: [] });
  });

  it("refuses a character only a subset family at another weight maps", () => {
    const tree = card({ family: "Inter, Inter #2", weight: 700, text: `Zacznij ${A_OGONEK}` });
    expect(findMissingGlyphs(tree, [font(LATIN, 400), font(LATIN_BOLD, 700), font(LATIN_EXT, 400, "Inter #2")])).toEqual({
      ok: true,
      value: [{ text: `Zacznij ${A_OGONEK}`, characters: [A_OGONEK] }],
    });
  });

  it("tries the named families before a family loaded earlier, as Satori does", () => {
    const fonts = [font(LATIN_EXT_BOLD, 700, "Inter Ext"), font(LATIN, 400), font(LATIN_BOLD, 700), font(LATIN_EXT, 400, "Inter #2")];
    expect(findMissingGlyphs(card({ family: "Inter, Inter #2", weight: 700, text: A_OGONEK }), fonts)).toEqual({ ok: true, value: [{ text: A_OGONEK, characters: [A_OGONEK] }] });
    expect(findMissingGlyphs(card({ family: "Inter", weight: 700, text: A_OGONEK }), fonts)).toEqual({ ok: true, value: [] });
  });

  it("returns a font it cannot read as an error", () => {
    expect(findMissingGlyphs(card({ text: "a" }), [font(Buffer.from("not a font"), 400)])).toEqual({
      ok: false,
      error: 'the font "Inter" 400 normal: the file is not a TrueType, OpenType or WOFF font',
    });
  });
});

describe("parseFontFamily", () => {
  it("splits like Satori: by comma, trimmed, outer quotes stripped, lowercased", () => {
    expect(parseFontFamily(`Inter, 'Inter #2' ,"Body Face"`)).toEqual(["inter", "inter #2", "body face"]);
  });
});

describe("describeCharacter", () => {
  it("shows the character and its code point", () => {
    expect([describeCharacter(A_OGONEK), describeCharacter(ROCKET)]).toEqual([`"${A_OGONEK}" (U+0105)`, `"${ROCKET}" (U+1F680)`]);
  });
});
