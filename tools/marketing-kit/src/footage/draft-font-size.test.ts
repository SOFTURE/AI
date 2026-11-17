import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import type { BrandFont } from "../config/config.js";
import { buildFootageDraftCaptions, FOOTAGE_DRAFT_FONT, loadFootageDraftFonts, type FootageDraftFonts } from "./draft.js";
import { buildDraftOverlayEvents } from "./draft-overlays.js";
import { createDraftFont, createDraftTextMeasure, getSpacingWidth, toDraftAssSize, toDraftSpacing, withLetterSpacing } from "./draft-text-width.js";
import type { Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { HAND_FONT } from "./hand-font.js";
import type { EdlOverlay } from "./overlay-schema.js";
import { getOverlayPadding, OVERLAY_LETTER_SPACING_EM, resolveEdlOverlays, type ResolvedOverlay } from "./overlays.js";

/** RV-193 of an adopting app: the draft sizes, spaces and breaks every text as the render does. */

const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const DEJAVU = readFileSync(FOOTAGE_DRAFT_FONT.file);
const CAVEAT = readFileSync(HAND_FONT.file);
/** DejaVu Sans Bold: usWinAscent + usWinDescent = 2384 of 2048 units per em. */
const DEJAVU_SCALE = 2384 / 2048;
/** Caveat SemiBold: 1289 of 1000. */
const CAVEAT_SCALE = 1.289;

const BODY: BrandFont = { family: "DejaVu Sans", fallback: "sans-serif", files: [{ path: FOOTAGE_DRAFT_FONT.file, weight: "700", style: "normal", unicodeRange: null }] };
const HEADING: BrandFont = { family: "Caveat", fallback: "cursive", files: [{ path: HAND_FONT.file, weight: "600", style: "normal", unicodeRange: null }] };

const film: FootageFilm = {
  id: "trip",
  title: "Trip",
  format: "9:16",
  language: "en",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  captionPreset: "reels",
  captionStyle: "highlight",
  endCard: null,
};

function resolve(overlays: EdlOverlay[]): ResolvedOverlay[] {
  const edl: Edl = { version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 20, transition: "cut", motion: "none" }], overlays };
  const result = resolveEdlOverlays({ film, edl, words: [], frame: FRAME, caption: CAPTION });
  if (!result.ok) throw new Error(result.problems.join("; "));
  return result.overlays;
}

const COLORS = { background: "#101820", foreground: "#f2f3f5", accent: "#ff3d7f" };
const fonts = (): FootageDraftFonts => loadFootageDraftFonts({ body: BODY, heading: HEADING });
const drawn = (set: FootageDraftFonts) => ({ fonts: set.heading.family === set.body.family ? {} : { heading: set.heading.family }, drawnFonts: set });

/** A TrueType file with only a `name` table naming `family`: libass can find it, its metrics cannot be read. */
function makeNameOnlyFont(family: string): Buffer {
  const text = Buffer.from(family, "utf16le").swap16();
  const name = Buffer.alloc(6 + 12 + text.length);
  name.writeUInt16BE(0, 0);
  name.writeUInt16BE(1, 2);
  name.writeUInt16BE(18, 4);
  [3, 1, 0x0409, 1, text.length, 0].forEach((value, index) => name.writeUInt16BE(value, 6 + index * 2));
  text.copy(name, 18);
  const directory = Buffer.alloc(12 + 16);
  directory.writeUInt32BE(0x00010000, 0);
  directory.writeUInt16BE(1, 4);
  directory.writeUInt32BE(0x6e616d65, 12);
  directory.writeUInt32BE(28, 20);
  directory.writeUInt32BE(name.length, 24);
  return Buffer.concat([directory, name]);
}

describe("createDraftFont", () => {
  it("reads the libass size of an em from the font's win metrics", () => {
    expect(createDraftFont(FOOTAGE_DRAFT_FONT, DEJAVU)?.assScale).toBe(DEJAVU_SCALE);
    expect(createDraftFont(HAND_FONT, CAVEAT)?.assScale).toBe(CAVEAT_SCALE);
  });

  it("measures a line in CSS px, as the browser lays it: the libass measure at the converted size", () => {
    const font = createDraftFont(FOOTAGE_DRAFT_FONT, DEJAVU);
    expect(font?.measure("Afryka", 96)).toBe(355);
    expect(font?.measure("Afryka", 64)).toBe(237);
    expect(font?.measure("", 64)).toBe(0);
    expect(createDraftFont(HAND_FONT, CAVEAT)?.measure("Afryka", 96)).toBe(223);
    const libass = createDraftTextMeasure(DEJAVU);
    expect(Math.abs((libass?.("Afryka", 96 * DEJAVU_SCALE) ?? 0) - (font?.measure("Afryka", 96) ?? 0))).toBeLessThanOrEqual(1);
  });

  it("keeps the family and the file it was given", () => {
    expect(createDraftFont({ family: "Brand Sans", file: "/fonts/brand.ttf" }, DEJAVU)).toMatchObject({ family: "Brand Sans", file: "/fonts/brand.ttf" });
  });

  it("is null for a file whose metrics cannot be read", () => {
    expect(createDraftFont(FOOTAGE_DRAFT_FONT, Buffer.alloc(8))).toBeNull();
    expect(createDraftFont(FOOTAGE_DRAFT_FONT, makeNameOnlyFont("Brand Sans"))).toBeNull();
    expect(createDraftFont(FOOTAGE_DRAFT_FONT, DEJAVU.subarray(0, 400))).toBeNull();
  });
});

describe("the draft's sizes and spacing", () => {
  it("writes an ASS size to the hundredth of a px", () => {
    expect(toDraftAssSize(64, DEJAVU_SCALE)).toBe(74.5);
    expect(toDraftAssSize(96, DEJAVU_SCALE)).toBe(111.75);
    expect(toDraftAssSize(57, CAVEAT_SCALE)).toBe(73.47);
    expect(toDraftAssSize(48, 1)).toBe(48);
  });

  it("spaces letters by the render's em, once after every character", () => {
    expect(toDraftSpacing(-0.01, 64)).toBe(-0.64);
    expect(toDraftSpacing(0.02, 46)).toBe(0.92);
    expect(getSpacingWidth("abc", -0.015, 100)).toBeCloseTo(-4.5, 9);
    expect(getSpacingWidth("", -0.015, 100)).toBe(0);
    const measure = withLetterSpacing((text) => text.length * 10, -0.01);
    expect(measure("abcd", 100)).toBe(36);
    expect(withLetterSpacing((text) => text.length * 10, 0)("ab", 100)).toBe(20);
  });
});

describe("loadFootageDraftFonts", () => {
  it("draws with the kit's font when the brand has none, every role the body's", () => {
    const set = loadFootageDraftFonts(undefined);
    expect(set.body).toMatchObject({ family: FOOTAGE_DRAFT_FONT.family, file: FOOTAGE_DRAFT_FONT.file, assScale: DEJAVU_SCALE });
    expect(set.heading).toBe(set.body);
    expect(set.interface).toBe(set.body);
  });

  it("gives a role its own font when the brand has one of another family", () => {
    const set = fonts();
    expect(set.body.family).toBe("DejaVu Sans");
    expect(set.heading).toMatchObject({ family: "Caveat", file: HAND_FONT.file, assScale: CAVEAT_SCALE });
    expect(set.interface).toBe(set.body);
  });

  it("draws a role of the body's family with the body's file, so libass never picks between two files of one family", () => {
    const set = loadFootageDraftFonts({ body: BODY, interface: { ...BODY, files: [{ ...BODY.files[0], path: "/fonts/other.ttf" } as BrandFont["files"][number]] } }, (path) => (path === "/fonts/other.ttf" ? DEJAVU : readFileSync(path)));
    expect(set.interface).toBe(set.body);
  });

  it("falls back to libass's own size and the estimate for a font whose metrics cannot be read", () => {
    const set = loadFootageDraftFonts({ body: { ...BODY, files: [{ path: "/fonts/name-only.ttf", weight: "700", style: "normal", unicodeRange: null }] } }, (path) => (path === "/fonts/name-only.ttf" ? makeNameOnlyFont("Name Only") : readFileSync(path)));
    expect(set.body).toMatchObject({ family: "Name Only", file: "/fonts/name-only.ttf", assScale: 1 });
    expect(set.body.measure("abcd", 100)).toBe(224);
  });

  it("falls back to the kit's font when no brand file can be read by libass", () => {
    const set = loadFootageDraftFonts({ body: { ...BODY, files: [{ path: "/fonts/broken.woff2", weight: "700", style: "normal", unicodeRange: null }] } }, (path) => (path === "/fonts/broken.woff2" ? Buffer.alloc(16) : readFileSync(path)));
    expect(set.body.file).toBe(FOOTAGE_DRAFT_FONT.file);
  });
});

describe("buildFootageDraftCaptions with the draft's fonts", () => {
  const words = ["Extraordinary", "unforgettable", "mountain", "monasteries"].map((text, index) => ({ text, start: 0.2 + index * 0.4, end: 0.5 + index * 0.4 }));
  const edl: Edl = { version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 5, transition: "cut", motion: "none" }] };
  const style = { cornerRadius: "m", padding: "m", shadow: "none", border: "none" } as const;

  it("writes the caption styles at the render's size and letter spacing", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words, caption: CAPTION, frame: FRAME, fonts: fonts(), style }) ?? "";
    expect(ass).toContain("Style: Caption,DejaVu Sans,74.5,");
    expect(ass).toMatch(/Style: Caption,DejaVu Sans,74\.5,(?:[^,]*,){8}100,100,-0\.64,0,/);
    expect(ass).toContain("Style: CaptionShape,DejaVu Sans,74.5,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,-0.64,0,");
  });

  it("keeps the given sizes, unspaced, without the draft's fonts (as before)", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words, caption: CAPTION, frame: FRAME, style }) ?? "";
    expect(ass).toContain("Style: Caption,DejaVu Sans,64,");
    expect(ass).toMatch(/Style: Caption,DejaVu Sans,64,(?:[^,]*,){8}100,100,0,0,/);
  });

  it("breaks a pill's words by their CSS widths: a line that fits at libass's size wraps at the render's", () => {
    // "mountain monasteries" is 800 CSS px with its spacing, past the pill's 784 px of room, but 698 at libass's own size.
    const lineCount = (ass: string): number => (ass.match(/\{\\an7\\pos\(0,0\)\\1c&H[0-9A-F]+&\\1a&H[0-9A-F]+&\\bord0\\shad0\\p1\}/g) ?? []).length;
    const rendered = buildFootageDraftCaptions({ film: { ...film, captionMaxWords: 2 }, edl, words, caption: CAPTION, frame: FRAME, fonts: fonts(), style }) ?? "";
    const before = buildFootageDraftCaptions({ film: { ...film, captionMaxWords: 2 }, edl, words, caption: CAPTION, frame: FRAME, measure: createDraftTextMeasure(DEJAVU), style }) ?? "";
    expect(rendered).toContain("mountain\\Nmonasteries");
    expect(before).not.toContain("mountain\\Nmonasteries");
    expect(lineCount(rendered)).toBeGreaterThan(0);
  });

  it("spaces a ribbon's capitals as the render does", () => {
    const ass = buildFootageDraftCaptions({ film: { ...film, captionStyle: "ribbon" }, edl, words, caption: CAPTION, frame: FRAME, fonts: fonts() }) ?? "";
    expect(ass).toContain("100,100,0.64,0,");
  });
});

describe("buildDraftOverlayEvents with the draft's fonts", () => {
  const events = (overlays: EdlOverlay[], set = fonts()): string => buildDraftOverlayEvents(resolve(overlays), COLORS, FRAME, drawn(set)).join("\n");

  it("sizes a heading in its own font's win metrics and spaces its letters as the render's title", () => {
    const [hook] = resolve([{ kind: "hook_title", at: 0, duration: 3, text: "Two ways" }]);
    if (hook?.kind !== "hook_title") throw new Error("a hook title");
    const ass = events([{ kind: "hook_title", at: 0, duration: 3, text: "Two ways" }]);
    expect(ass).toContain(`\\fs${String(toDraftAssSize(hook.fontSize, CAVEAT_SCALE))}\\fsp${String(toDraftSpacing(OVERLAY_LETTER_SPACING_EM.hookTitle, hook.fontSize))}\\fnCaveat`);
  });

  it("sizes a place card's title and its subtitle each in its role's font", () => {
    const [card] = resolve([{ kind: "place_card", at: 0, duration: 3, text: "Thailand", subtitle: "Bangkok and the islands" }]);
    if (card?.kind !== "place_card") throw new Error("a place card");
    const ass = events([{ kind: "place_card", at: 0, duration: 3, text: "Thailand", subtitle: "Bangkok and the islands" }]);
    expect(ass).toContain(`\\fs${String(toDraftAssSize(card.fontSize, CAVEAT_SCALE))}\\fsp${String(toDraftSpacing(OVERLAY_LETTER_SPACING_EM.placeTitle, card.fontSize))}\\fnCaveat`);
    expect(ass).toContain(`\\fs${String(toDraftAssSize(Math.round(card.subtitleFontSize), DEJAVU_SCALE))}\\fsp${String(toDraftSpacing(OVERLAY_LETTER_SPACING_EM.card, Math.round(card.subtitleFontSize)))}`);
  });

  it("sizes a counter's number and its unit in the heading's font", () => {
    const [counter] = resolve([{ kind: "counter", at: 0, duration: 3, value: 2800, unit: "PLN" }]);
    if (counter?.kind !== "counter") throw new Error("a counter");
    const ass = events([{ kind: "counter", at: 0, duration: 3, value: 2800, unit: "PLN" }]);
    expect(ass).toContain(`\\an5\\fs${String(toDraftAssSize(counter.fontSize, CAVEAT_SCALE))}`);
    expect(ass).toContain(`{\\fs${String(toDraftAssSize(counter.unitFontSize, CAVEAT_SCALE))}} PLN`);
  });

  it("draws a search query unspaced, as the render does", () => {
    const ass = events([{ kind: "search_bar", at: 0, duration: 3, text: "vaccines before Asia" }]);
    expect(ass).toMatch(/\\an4\\fs[0-9.]+\\fn|\\an4\\fs[0-9.]+\\1c|\\an4\\fs[0-9.]+(?:\\[a-z])/);
    expect(ass).not.toMatch(/\\an4\\fs[0-9.]+\\fsp/);
  });

  it("breaks a keyword wider than its box where the render's card breaks it, its lines from the box's left on either side", () => {
    const overlay: EdlOverlay = { kind: "keyword", at: 0, duration: 3, text: "booklet = yellow fever certificate of vaccination", style: { side: "right" } };
    const [keyword] = resolve([overlay]);
    if (keyword?.kind !== "keyword") throw new Error("a keyword");
    const ass = events([overlay]);
    expect(ass).toContain("\\N");
    const padX = getOverlayPadding(keyword).x;
    expect(ass).toContain(`\\an7\\fs${String(toDraftAssSize(keyword.fontSize, CAVEAT_SCALE))}\\fsp${String(toDraftSpacing(OVERLAY_LETTER_SPACING_EM.card, keyword.fontSize))}`);
    expect(ass).toContain(`\\pos(${String(Math.round(keyword.box.left + padX))},`);
  });

  it("keeps a keyword that fits on one line, on its side", () => {
    const ass = events([{ kind: "keyword", at: 0, duration: 3, text: "3x", style: { side: "right" } }]);
    expect(ass).not.toContain("\\N");
    expect(ass).toContain("\\an9");
  });

  it("types a wrapped lower third over its breaks, a break counted as the space it replaces", () => {
    const ass = events([{ kind: "lower_third", at: 0, duration: 3, text: "The travel medicine clinic on the other side of Warsaw", style: { entrance: "type" } }]);
    const typed = ass.split("\n").filter((line) => line.includes("\\N"));
    expect(typed.length).toBeGreaterThan(1);
    expect(ass).not.toContain("");
  });

  it("drops a wrapped keyword's letters in with its breaks kept", () => {
    const ass = events([{ kind: "keyword", at: 0, duration: 3, text: "booklet = yellow fever certificate of vaccination", style: { entrance: "drop" } }]);
    expect(ass).toContain("\\N");
    expect(ass).not.toContain("");
  });

  it("sizes a list's points and a chip's number in their fonts", () => {
    const overlay: EdlOverlay = { kind: "list", at: 0, duration: 3, items: ["Hepatitis", "Typhoid"] };
    const [list] = resolve([overlay]);
    if (list?.kind !== "list") throw new Error("a list");
    expect(events([overlay])).toContain(`\\fs${String(toDraftAssSize(list.fontSize, DEJAVU_SCALE))}\\fsp${String(toDraftSpacing(OVERLAY_LETTER_SPACING_EM.card, list.fontSize))}`);
    const chips = events([{ kind: "list", at: 0, duration: 3, items: ["A", "B"], style: { list_layout: "chips" } }]);
    expect(chips).toMatch(/\\an5\\fs[0-9.]+\\b1/);
  });

  it("spaces a paper strip's capitals in the heading's font", () => {
    const [strip] = resolve([{ kind: "note", at: 0, duration: 3, text: "Book early", style: { note_style: "strip" } }]);
    if (strip?.kind !== "note") throw new Error("a note");
    const ass = events([{ kind: "note", at: 0, duration: 3, text: "Book early", style: { note_style: "strip" } }]);
    expect(ass).toContain(`\\fs${String(toDraftAssSize(strip.fontSize, CAVEAT_SCALE))}\\fsp${String(toDraftSpacing(OVERLAY_LETTER_SPACING_EM.strip, strip.fontSize))}\\fnCaveat\\b1`);
  });

  it("writes every size as given and no spacing without the draft's fonts (as before)", () => {
    const [hook] = resolve([{ kind: "hook_title", at: 0, duration: 3, text: "Two ways" }]);
    const ass = buildDraftOverlayEvents(resolve([{ kind: "hook_title", at: 0, duration: 3, text: "Two ways" }]), COLORS, FRAME).join("\n");
    expect(ass).toContain(`\\fs${String(hook?.kind === "hook_title" ? hook.fontSize : 0)}`);
    expect(ass).not.toContain("\\fsp");
  });
});
