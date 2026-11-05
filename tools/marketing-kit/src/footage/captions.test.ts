import { describe, expect, it } from "vitest";

import type { BrandFont } from "../config/config.js";
import type { TimedWord } from "../voice/voiceover.js";
import { CAPTION_SAFE_ZONES, applySegmentCaption, findMissingCaptionGlyphs, getCaptionBounds, getCaptionChunkLayouts, getCaptionKeepsWithNext, getCaptionPresetLayout, getFootageCaptionChunks, getFootageCaptionLayout, getSegmentCaptionLayout, phraseChunks } from "./captions.js";
import type { Edl } from "./edl.js";

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

  it("ends a phrase on a kept word neither at a pause nor at six words", () => {
    const keepsWithNext = (word: TimedWord) => word.text === "a";
    const texts = (chunks: { words: TimedWord[] }[]) => chunks.map((chunk) => chunk.words.map((word) => word.text).join(" "));
    expect(texts(phraseChunks([w("Buy", 0), w("a", 0.4), w("house.", 2)], { keepsWithNext }))).toEqual(["Buy a house."]);
    expect(texts(phraseChunks([w("Buy", 0), w("a", 0.4), w("house.", 2)]))).toEqual(["Buy a", "house."]);
    const six = ["p", "b", "c", "d", "e", "a", "f", "g."].map((text, index) => w(text, index * 0.4));
    expect(texts(phraseChunks(six, { keepsWithNext }))).toEqual(["p b c d e", "a f g."]);
    expect(texts(phraseChunks(six))).toEqual(["p b c d e a", "f g."]);
  });

  it("times a phrase from its first word's start to its last word's end", () => {
    expect(phraseChunks([w("Hi", 1), w("there.", 1.4)])[0]).toMatchObject({ start: 1, end: 1.7 });
  });
});

describe("getCaptionKeepsWithNext", () => {
  const kept = (film: Parameters<typeof getCaptionKeepsWithNext>[0], texts: string[]) => texts.filter((text) => getCaptionKeepsWithNext(film)(w(text, 0)));

  it("keeps the language's default words, in any case, and every number", () => {
    expect(kept({ language: "pl" }, ["W", "z", "na", "dom", "50", "1,5", "2.000", "50,", "x50"])).toEqual(["W", "z", "na", "50", "1,5", "2.000"]);
    expect(kept({ language: "en" }, ["The", "a", "an", "of", "7"])).toEqual(["The", "a", "an", "7"]);
    expect(kept({ language: "de" }, ["der", "7"])).toEqual(["7"]);
  });

  it("keeps the film's own words instead of the default, numbers only for an empty list or no language", () => {
    expect(kept({ language: "pl", captionKeepWithNext: ["Vom"] }, ["vom", "w", "3"])).toEqual(["vom", "3"]);
    expect(kept({ language: "pl", captionKeepWithNext: [] }, ["w", "3"])).toEqual(["3"]);
    expect(kept({}, ["a", "3"])).toEqual(["3"]);
  });
});

describe("getFootageCaptionChunks", () => {
  const words = ["one", "two", "three", "four", "five", "w", "six", "seven."].map((text, index) => w(text, index * 0.4));
  const texts = (chunks: { words: TimedWord[] }[]) => chunks.map((chunk) => chunk.words.map((word) => word.text).join(" "));

  it("cuts phrases or highlight chunks, keeping the film's kept words with the next, and nothing without captions", () => {
    const film = { language: "pl", captions: true } as const;
    expect(texts(getFootageCaptionChunks(film, words))).toEqual(["one two three four five", "w six seven."]);
    expect(texts(getFootageCaptionChunks({ ...film, captionStyle: "highlight" }, words))).toEqual(["one two three four", "five w six seven."]);
    expect(texts(getFootageCaptionChunks({ ...film, captionKeepWithNext: [] }, words))).toEqual(["one two three four five w", "six seven."]);
    expect(getFootageCaptionChunks({ ...film, captions: false }, words)).toEqual([]);
  });
});

describe("getCaptionPresetLayout", () => {
  it("anchors the caption box's foot at the platform's bottom margin, centred between equal sides", () => {
    expect(getCaptionPresetLayout("tiktok", 50)).toEqual({ top: 1275, bottom: 480, left: 150, right: 150, fontSize: 50 });
    expect(getCaptionPresetLayout("reels", 50)).toMatchObject({ top: 1335, bottom: 420 });
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

describe("segment caption boxes", () => {
  const film = { format: "9:16" as const, captionPreset: "reels" as const };
  const edl: Edl = {
    version: 2,
    film: "f",
    segments: [
      { id: "s1", clip: "a", start: 0, end: 2, transition: "cut", motion: "none" },
      { id: "s2", clip: "a", start: 2, end: 4, transition: "cut", motion: "none", caption: { bottom: 1150 } },
      { id: "s3", clip: "a", start: 4, end: 6, transition: "cut", motion: "none", caption: { top: 300 } },
    ],
  };
  const base = getFootageCaptionLayout(film);

  it("merges a segment's bottom over the film's box and keeps the film's box elsewhere", () => {
    expect(getSegmentCaptionLayout(film, edl, 0)).toEqual(base);
    expect(getSegmentCaptionLayout(film, edl, 1)).toEqual({ ...base, bottom: 1150 });
  });

  it("hangs a box from a segment's top alone, dropping the film's foot", () => {
    expect(getSegmentCaptionLayout(film, edl, 2)).toEqual({ top: 300, left: base.left, right: base.right, fontSize: base.fontSize });
    expect(applySegmentCaption(base, { top: 300, bottom: 500 })).toEqual({ ...base, top: 300, bottom: 500 });
  });

  it("gives each chunk the box of the segment its first word starts in, the cut's edge belonging to the later one", () => {
    const layouts = getCaptionChunkLayouts([{ start: 0.5 }, { start: 1.9 }, { start: 2 }, { start: 5 }, { start: 9 }], edl, base);
    expect(layouts.map((layout) => layout.bottom ?? `top ${layout.top}`)).toEqual([base.bottom, base.bottom, 1150, "top 300", "top 300"]);
  });

  it("bounds a box by the frame less one caption card", () => {
    expect(getCaptionBounds(1920, { fontSize: 64 })).toEqual({ frameHeight: 1920, cardHeight: 108 });
  });
});
