import { describe, expect, it } from "vitest";

import type { BrandFont } from "../config/config.js";
import type { TimedWord } from "../voice/voiceover.js";
import { CAPTION_SAFE_ZONES, findMissingCaptionGlyphs, getCaptionPresetLayout, phraseChunks } from "./captions.js";

const w = (text: string, start: number): TimedWord => ({ text, start, end: start + 0.3 });

describe("phraseChunks", () => {
  it("ends a phrase at punctuation, after six words and at a pause", () => {
    const words = [w("One", 0), w("two,", 0.4), w("a", 0.8), w("b", 1.2), w("c", 1.6), w("d", 2), w("e", 2.4), w("f", 2.8), w("late", 5), w("words", 5.4)];
    expect(phraseChunks(words).map((chunk) => chunk.words.map((word) => word.text).join(" "))).toEqual(["One two,", "a b c d e f", "late words"]);
  });

  it("joins a lone word to the phrase before it, but not across a pause or into a full phrase", () => {
    expect(phraseChunks([w("Hi", 0), w("there.", 0.4), w("Yes.", 0.8)]).map((chunk) => chunk.words.length)).toEqual([3]);
    expect(phraseChunks([w("Hi", 0), w("there.", 0.4), w("Yes.", 3)]).map((chunk) => chunk.words.length)).toEqual([2, 1]);
    expect(phraseChunks([])).toEqual([]);
  });

  it("times a phrase from its first word's start to its last word's end", () => {
    expect(phraseChunks([w("Hi", 1), w("there.", 1.4)])[0]).toMatchObject({ start: 1, end: 1.7 });
  });
});

describe("getCaptionPresetLayout", () => {
  it("keeps two caption lines above the platform's bottom margin, centred between equal sides", () => {
    expect(getCaptionPresetLayout("tiktok", 50)).toEqual({ top: 1275, left: 150, right: 150, fontSize: 50 });
    expect(getCaptionPresetLayout("reels", 50).top).toBe(1335);
  });

  it("makes all the zone that is safe everywhere", () => {
    const { reels, shorts, tiktok, all } = CAPTION_SAFE_ZONES;
    for (const side of ["top", "bottom", "left", "right"] as const) expect(all[side]).toBe(Math.max(reels[side], shorts[side], tiktok[side]));
  });
});

/** A minimal TrueType file whose cmap (format 4) maps the given code points (each below 0xFFFF). */
function fontWith(codePoints: number[]): Buffer {
  const sorted = [...codePoints].sort((a, b) => a - b);
  const segments = [...sorted.map((point) => ({ start: point, end: point })), { start: 0xffff, end: 0xffff }];
  const count = segments.length;
  const subtable = Buffer.alloc(16 + count * 8);
  subtable.writeUInt16BE(4, 0);
  subtable.writeUInt16BE(subtable.length, 2);
  subtable.writeUInt16BE(count * 2, 6);
  segments.forEach((segment, index) => {
    subtable.writeUInt16BE(segment.end, 14 + index * 2);
    subtable.writeUInt16BE(segment.start, 16 + count * 2 + index * 2);
    // idDelta maps the code point to glyph 1 (any glyph but .notdef); the last segment maps to 0.
    subtable.writeUInt16BE(segment.start === 0xffff ? 1 : (1 - segment.start) & 0xffff, 16 + count * 4 + index * 2);
  });
  const cmap = Buffer.concat([Buffer.from([0, 0, 0, 1, 0, 3, 0, 1, 0, 0, 0, 12]), subtable]);
  const header = Buffer.alloc(12 + 16);
  header.writeUInt32BE(0x00010000, 0);
  header.writeUInt16BE(1, 4);
  header.write("cmap", 12, "latin1");
  header.writeUInt32BE(28, 20);
  header.writeUInt32BE(cmap.length, 24);
  return Buffer.concat([header, cmap]);
}

describe("findMissingCaptionGlyphs", () => {
  const latin = [..."abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ.,!"].map((character) => character.codePointAt(0) ?? 0);
  const files: Record<string, Buffer> = { "/f/body.ttf": fontWith(latin), "/f/body-ext.ttf": fontWith(["ř".codePointAt(0) ?? 0]), "/f/heading.ttf": fontWith(latin) };
  const read = (path: string): Buffer => files[path] ?? Buffer.alloc(0);
  const font = (family: string, ...paths: string[]): BrandFont => ({ family, fallback: "sans-serif", files: paths.map((path) => ({ path, weight: "400", style: "normal", unicodeRange: null })) });

  it("names the letters no file of the family draws, once per family", () => {
    const missing = findMissingCaptionGlyphs(
      { fonts: { heading: font("Head", "/f/heading.ttf"), body: font("Body", "/f/body.ttf", "/f/body-ext.ttf") }, captions: ["Přímý", "kůň"], endCard: { headline: "Těžké", url: "a.cz", note: "" }, brandName: "Acme" },
      read,
    );
    expect(missing).toEqual([
      { font: "Body", characters: ["í", "ý", "ů", "ň"] },
      { font: "Head", characters: ["ě", "ž", "é"] },
    ]);
  });

  it("checks nothing without a brand font, or with a file it cannot read", () => {
    expect(findMissingCaptionGlyphs({ fonts: { heading: null, body: null }, captions: ["kůň"], endCard: null, brandName: "A" }, read)).toEqual([]);
    expect(findMissingCaptionGlyphs({ fonts: { heading: null, body: font("Body", "/f/broken.woff2") }, captions: ["kůň"], endCard: null, brandName: "A" }, read)).toEqual([]);
  });
});
