import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import type { BrandFont, FontFile } from "../config/config.js";
import { FOOTAGE_DRAFT_FONT } from "./draft.js";
import { chooseFootageDraftFont, readFontFamilyName } from "./draft-font.js";

/** A TrueType file with only a `name` table holding the given records. */
function makeFont(records: { platform: number; language: number; nameId: number; text: string }[], signature = 0x00010000): Buffer {
  const encoded = records.map((record) => (record.platform === 1 ? Buffer.from(record.text, "latin1") : Buffer.from(record.text, "utf16le").swap16()));
  const headerSize = 6 + records.length * 12;
  const name = Buffer.alloc(headerSize + encoded.reduce((sum, bytes) => sum + bytes.length, 0));
  name.writeUInt16BE(0, 0);
  name.writeUInt16BE(records.length, 2);
  name.writeUInt16BE(headerSize, 4);
  let offset = 0;
  records.forEach((record, index) => {
    const at = 6 + index * 12;
    const bytes = encoded[index] as Buffer;
    name.writeUInt16BE(record.platform, at);
    name.writeUInt16BE(record.platform === 3 ? 1 : 0, at + 2);
    name.writeUInt16BE(record.language, at + 4);
    name.writeUInt16BE(record.nameId, at + 6);
    name.writeUInt16BE(bytes.length, at + 8);
    name.writeUInt16BE(offset, at + 10);
    bytes.copy(name, headerSize + offset);
    offset += bytes.length;
  });
  const directory = Buffer.alloc(12 + 16);
  directory.writeUInt32BE(signature, 0);
  directory.writeUInt16BE(1, 4);
  directory.write("name", 12, "latin1");
  directory.writeUInt32BE(28, 20);
  directory.writeUInt32BE(name.length, 24);
  return Buffer.concat([directory, name]);
}

describe("readFontFamilyName", () => {
  it("reads the shipped font's own family", () => {
    expect(readFontFamilyName(readFileSync(FOOTAGE_DRAFT_FONT.file))).toEqual({ ok: true, value: "DejaVu Sans" });
  });

  it("prefers the Windows US English family over other languages and the Macintosh record", () => {
    const font = makeFont([
      { platform: 1, language: 0, nameId: 1, text: "Mac Family" },
      { platform: 3, language: 0x0415, nameId: 1, text: "Local Family" },
      { platform: 3, language: 0x0409, nameId: 4, text: "Brand Sans SemiBold" },
      { platform: 3, language: 0x0409, nameId: 1, text: "Brand Sans SemiBold" },
    ]);
    expect(readFontFamilyName(font)).toEqual({ ok: true, value: "Brand Sans SemiBold" });
    expect(readFontFamilyName(makeFont([{ platform: 1, language: 0, nameId: 1, text: "Mac Family" }]))).toEqual({ ok: true, value: "Mac Family" });
  });

  it("is an error for WOFF2, a font without a family and a cut file", () => {
    expect(readFontFamilyName(makeFont([{ platform: 3, language: 0x0409, nameId: 1, text: "Brand" }], 0x774f4632))).toEqual({ ok: false, error: "the file is not a TrueType or OpenType font" });
    expect(readFontFamilyName(makeFont([{ platform: 3, language: 0x0409, nameId: 4, text: "Brand Bold" }]))).toEqual({ ok: false, error: "the font names no family" });
    expect(readFontFamilyName(makeFont([{ platform: 3, language: 0x0409, nameId: 1, text: "Brand" }]).subarray(0, 40))).toEqual({ ok: false, error: "the font file is cut short" });
    expect(readFontFamilyName(Buffer.alloc(2))).toEqual({ ok: false, error: "the font file is cut short" });
  });
});

describe("chooseFootageDraftFont", () => {
  const file = (path: string, weight: string, style: FontFile["style"] = "normal"): FontFile => ({ path, weight, style, unicodeRange: null });
  const fonts: Record<string, Buffer> = {
    "/regular.ttf": makeFont([{ platform: 3, language: 0x0409, nameId: 1, text: "Brand Regular" }]),
    "/semibold.ttf": makeFont([{ platform: 3, language: 0x0409, nameId: 1, text: "Brand SemiBold" }]),
    "/bold-italic.ttf": makeFont([{ platform: 3, language: 0x0409, nameId: 1, text: "Brand Bold Italic" }]),
    "/variable.woff2": makeFont([{ platform: 3, language: 0x0409, nameId: 1, text: "Brand" }], 0x774f4632),
  };
  const read = (path: string): Buffer => fonts[path] ?? Buffer.alloc(0);
  const brand = (files: FontFile[]): BrandFont => ({ family: "Brand", fallback: "sans-serif", files });

  it("takes the normal file closest to the caption weight, with the family the file names", () => {
    const font = brand([file("/regular.ttf", "400"), file("/bold-italic.ttf", "650", "italic"), file("/semibold.ttf", "600")]);
    expect(chooseFootageDraftFont(font, read)).toEqual({ file: "/semibold.ttf", family: "Brand SemiBold" });
  });

  it("skips a file ffmpeg cannot read, even inside the weight range, and is null when none is left", () => {
    expect(chooseFootageDraftFont(brand([file("/variable.woff2", "100 900"), file("/regular.ttf", "400")]), read)).toEqual({ file: "/regular.ttf", family: "Brand Regular" });
    expect(chooseFootageDraftFont(brand([file("/variable.woff2", "100 900")]), read)).toBeNull();
    expect(chooseFootageDraftFont(null, read)).toBeNull();
  });
});
