import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  getCaptionCornerRadius,
  getCornerRadiusCss,
  getCornerRadiusPx,
  getStyleBorderCss,
  getStylePadding,
  getStyleShadowCss,
  type BrandStyle,
} from "./brand-style.js";
import { getStyledPillCss } from "./compose.js";
import { getDraftBoxEvents } from "./draft-boxes.js";
import { buildFootageDraftCaptions, FOOTAGE_DRAFT_FONT } from "./draft.js";
import { buildDraftOverlayEvents, getDraftCardRadius } from "./draft-overlays.js";
import { createDraftTextMeasure, wrapDraftLine } from "./draft-text-width.js";
import type { Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { getOverlayMarkup } from "./overlay-html.js";
import { overlaySchema } from "./overlay-schema.js";
import { getDrawnOverlayCard, type ResolvedOverlay } from "./overlays.js";

const STYLE: BrandStyle = { cornerRadius: "l", padding: "m", shadow: "soft", border: "thin" };
const FRAME = { width: 1080, height: 1920 };

describe("brand style tokens", () => {
  it("gives each radius token its px of a 1080 px frame, scaled, never past half the box", () => {
    expect([getCornerRadiusPx("none", 100), getCornerRadiusPx("s", 100), getCornerRadiusPx("m", 100), getCornerRadiusPx("l", 100)]).toEqual([0, 12, 22, 36]);
    expect(getCornerRadiusPx("l", 100, 0.5)).toBe(18);
    expect(getCornerRadiusPx("l", 40)).toBe(20);
    expect(getCornerRadiusPx("pill", 41)).toBe(20.5);
  });

  it("writes the radius, shadow and border as CSS", () => {
    expect([getCornerRadiusCss("m"), getCornerRadiusCss("l", 0.5), getCornerRadiusCss("pill")]).toEqual(["22px", "18px", "999px"]);
    expect(getStyleShadowCss({ shadow: "soft" })).toBe("0 14px 44px rgba(0,0,0,0.4)");
    expect(getStyleShadowCss({ shadow: "none" })).toBe("none");
    expect(getStyleBorderCss({ border: "thin" }, "#ff0000")).toBe("3px solid #ff0000");
    expect(getStyleBorderCss({ border: "thin" }, "#ff0000", 0.2)).toBe("1px solid #ff0000");
    expect(getStyleBorderCss({ border: "none" }, "#ff0000")).toBe("none");
  });

  it("scales the pill's padding and lets the captions name their own corner", () => {
    expect([getStylePadding({ y: 16, x: 28 }, "s"), getStylePadding({ y: 16, x: 28 }, "m"), getStylePadding({ y: 16, x: 28 }, "l")]).toEqual([
      { y: 12, x: 21 },
      { y: 16, x: 28 },
      { y: 22, x: 38 },
    ]);
    expect(getCaptionCornerRadius(STYLE)).toBe("l");
    expect(getCaptionCornerRadius({ ...STYLE, captionCornerRadius: "pill" })).toBe("pill");
  });
});

describe("createDraftTextMeasure", () => {
  const measure = createDraftTextMeasure(readFileSync(FOOTAGE_DRAFT_FONT.file));

  it("measures a line from the font's advances at libass's scale", () => {
    if (measure === null) throw new Error("the shipped draft font is unreadable");
    const one = measure("Hello", 50);
    expect(one).toBeGreaterThan(100);
    expect(one).toBeLessThan(200);
    expect(measure("Hello Hello", 50)).toBeGreaterThan(2 * one - 2);
    expect(measure("Hello", 100)).toBeGreaterThanOrEqual(2 * one - 1);
    expect(measure("", 50)).toBe(0);
    // A character the font lacks is measured as its .notdef glyph, never as nothing.
    expect(measure("\u{1F600}", 50)).toBeGreaterThan(0);
  });

  it("is null for a file that is no font, or a font without metrics", () => {
    expect(createDraftTextMeasure(Buffer.from("not a font at all"))).toBeNull();
    // An sfnt header with no tables: readable, but without hhea and hmtx.
    const empty = Buffer.alloc(12);
    empty.writeUInt32BE(0x00010000, 0);
    expect(createDraftTextMeasure(empty)).toBeNull();
    // A truncated table directory is an error value of the reader, never an exception.
    const truncated = Buffer.alloc(12);
    truncated.writeUInt32BE(0x00010000, 0);
    truncated.writeUInt16BE(3, 4);
    expect(createDraftTextMeasure(truncated)).toBeNull();
  });

  it("breaks words greedily into lines that fit, a too wide word alone", () => {
    const byLetters = (text: string, size: number) => text.length * size;
    expect(wrapDraftLine(["ab", "cd", "efghij", "k"], 5, 1, byLetters)).toEqual([["ab", "cd"], ["efghij"], ["k"]]);
    expect(wrapDraftLine([], 5, 1, byLetters)).toEqual([]);
  });
});

describe("getDraftBoxEvents", () => {
  const base = { layer: 0, at: "0:00:00.00,0:00:01.00", styleName: "CaptionShape", box: { left: 10, top: 20, width: 200, height: 60 }, radius: 12, color: "#000000e6", accent: "#ff8800", scale: 1 };

  it("draws the soft shadow, the box in its colour and opacity, and the thin accent border, in that order", () => {
    const events = getDraftBoxEvents({ ...base, style: { shadow: "soft", border: "thin" } });
    expect(events).toHaveLength(3);
    expect(events[0]).toContain("\\1c&H000000&\\1a&H99&\\bord0\\shad0\\blur15\\p1}m 22 34 ");
    expect(events[1]).toContain("{\\an7\\pos(0,0)\\1c&H000000&\\1a&H19&\\bord0\\shad0\\p1}m 22 20 l 198 20 ");
    expect(events[2]).toContain("\\1a&HFF&\\3c&H0088FF&\\3a&H00&\\bord3\\shad0");
  });

  it("draws only the box without shadow and border, and moves every drawing with the motion", () => {
    const events = getDraftBoxEvents({ ...base, style: { shadow: "none", border: "none" }, motion: "\\move(0,28,0,0,0,300)\\fad(150,250)" });
    expect(events).toEqual(["Dialogue: 0,0:00:00.00,0:00:01.00,CaptionShape,,0,0,0,,{\\an7\\move(0,28,0,0,0,300)\\fad(150,250)\\1c&H000000&\\1a&H19&\\bord0\\shad0\\p1}m 22 20 l 198 20 b 205 20 210 25 210 32 l 210 68 b 210 75 205 80 198 80 l 22 80 b 15 80 10 75 10 68 l 10 32 b 10 25 15 20 22 20{\\p0}"]);
  });
});

const film: FootageFilm = {
  id: "street",
  title: "Street",
  format: "9:16",
  language: "pl",
  clips: [],
  isolateVoice: false,
  cut: { fillers: [], pauseSeconds: 0.6, padSeconds: 0.1, maxSeconds: null },
  transitions: DEFAULT_TRANSITIONS,
  music: { source: { kind: "none" }, volume: 0.35, duckedVolume: 0.1 },
  captions: true,
  endCard: null,
  captionStyle: "highlight",
};
const edl: Edl = { version: 2, film: "street", segments: [{ id: "s1", clip: "talk", start: 0, end: 3, transition: "cut", motion: "none" }] };
const words = [
  { text: "Hello", start: 0.1, end: 0.4 },
  { text: "brand", start: 0.5, end: 0.8 },
  { text: "style", start: 0.9, end: 1.2 },
];
const caption = { top: 1470, bottom: 300, left: 150, right: 150, fontSize: 50 };
const byLetters = (text: string, size: number) => Math.ceil(text.length * size * 0.5);

function dialogue(ass: string | null): string[] {
  return (ass ?? "").split("\n").filter((line) => line.startsWith("Dialogue:"));
}

describe("buildFootageDraftCaptions with a brand style", () => {
  it("draws a highlight chunk on a rounded pill that fits its text, the text without libass's box", () => {
    const ass = buildFootageDraftCaptions({ film, edl, words, caption, frame: FRAME, style: { ...STYLE, shadow: "none", border: "none" }, measure: byLetters });
    expect(ass).toContain("Style: CaptionShape,DejaVu Sans,50,&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,0,0,7,0,0,0,1\n");
    const lines = dialogue(ass);
    // "Hello brand style" is 17 letters: 425 px, plus 2 x 28 px, centred in the 780 px box; one line of 50 px plus
    // 2 x 16 px, its text's foot 300 px up; the l corner 36 px.
    expect(lines[0]).toBe(
      "Dialogue: 0,0:00:00.05,0:00:01.55,CaptionShape,,0,0,0,,{\\an7\\pos(0,0)\\1c&H111111&\\1a&H00&\\bord0\\shad0\\p1}m 336 1554 l 745 1554 b 764 1554 781 1570 781 1590 l 781 1600 b 781 1620 764 1636 745 1636 l 336 1636 b 316 1636 300 1620 300 1600 l 300 1590 b 300 1570 316 1554 336 1554{\\p0}",
    );
    expect(lines.slice(1).every((line) => line.includes(",Caption,,0,0,0,,{\\3a&HFF&\\4a&HFF&}"))).toBe(true);
  });

  it("breaks a chunk too wide for the box into lines with \\N and grows the pill by a line", () => {
    const narrow = { ...caption, left: 400, right: 400 };
    const lines = dialogue(buildFootageDraftCaptions({ film, edl, words, caption: narrow, frame: FRAME, style: { ...STYLE, shadow: "none", border: "none" }, measure: byLetters }));
    // Three lines of one word (125 px each, 181 px with the padding): 182 px tall, ending where one line would.
    expect(lines[0]).toContain("m 486 1454 l 595 1454 ");
    expect(lines[0]).toContain("l 486 1636 ");
    expect(lines[1]).toContain("Hello\\Nbrand\\Nstyle");
  });

  it("hangs the pill from the box's top without a foot, and names the lit word's box as the border's accent", () => {
    const top = { top: 1470, left: 150, right: 150, fontSize: 50 };
    const boxFilm: FootageFilm = { ...film, captionHighlightStyle: "box" };
    const colors = { captionBackground: "#000000", captionText: "#ffffff", captionHighlight: "#ff8800", captionHighlightBox: "#00ff00", captionHighlightText: "#000000" };
    const lines = dialogue(buildFootageDraftCaptions({ film: boxFilm, edl, words, caption: top, frame: FRAME, colors, style: STYLE, measure: byLetters }));
    expect(lines[1]).toContain("{\\an7\\pos(0,0)\\1c&H000000&\\1a&H00&\\bord0\\shad0\\p1}m 336 1454 ");
    expect(lines[2]).toContain("\\3c&H00FF00&\\3a&H00&\\bord3");
    // No layer-0 pill text over the drawn pill: only the lit box (layer 1) and the text (layer 2).
    expect(lines.filter((line) => line.startsWith("Dialogue: 0,") && line.includes(",Caption,"))).toEqual([]);
    expect(lines.some((line) => line.startsWith("Dialogue: 1,"))).toBe(true);
  });

  it("measures by the estimate without a measure, and leaves a phrase film and a film without style as before", () => {
    expect(dialogue(buildFootageDraftCaptions({ film, edl, words, caption, frame: FRAME, style: STYLE }))[1]).toContain("CaptionShape");
    const phrase = buildFootageDraftCaptions({ film: { ...film, captionStyle: "phrase" }, edl, words, caption, frame: FRAME, style: STYLE });
    expect(phrase).not.toContain("CaptionShape");
    expect(buildFootageDraftCaptions({ film, edl, words, caption, frame: FRAME })).not.toContain("CaptionShape");
  });
});

/** A resolved overlay with the fields the drawing reads; the rest as `resolveEdlOverlays` writes them. */
function overlay(fields: Readonly<Record<string, unknown>> & { kind: ResolvedOverlay["kind"] }): ResolvedOverlay {
  return { index: 0, start: 0, end: 2, entrance: null, typing: null, colors: {}, cornerRadius: null, ...fields } as unknown as ResolvedOverlay;
}

describe("overlay cards in the brand style", () => {
  const title = overlay({ kind: "hook_title", lines: ["Two ways"], place: null, fontSize: 60, placeFontSize: 30, box: { left: 100, top: 200, width: 600, height: 100 } });
  const search = overlay({ kind: "search_bar", text: "hanoi", fontSize: 40, box: { left: 100, top: 600, width: 800, height: 80 } });
  const colors = { background: "#000000", foreground: "#ffffff", accent: "#ff8800" };

  it("takes the card's own token, else the style's (a search bar stays a pill), else the kind's own corner", () => {
    expect(getDraftCardRadius({ kind: "hook_title", cornerRadius: null }, { height: 100 }, { scale: 1 }, 25)).toBe(25);
    expect(getDraftCardRadius({ kind: "hook_title", cornerRadius: null }, { height: 100 }, { scale: 1, style: STYLE }, 25)).toBe(36);
    expect(getDraftCardRadius({ kind: "search_bar", cornerRadius: null }, { height: 80 }, { scale: 1, style: STYLE }, 40)).toBe(40);
    expect(getDraftCardRadius({ kind: "search_bar", cornerRadius: "s" }, { height: 80 }, { scale: 1, style: STYLE }, 40)).toBe(12);
    expect(getDraftCardRadius({ kind: "hook_title", cornerRadius: "none" }, { height: 100 }, { scale: 1 }, 25)).toBe(0);
  });

  it("draws a card's shadow, box and border with the style, and the box alone without it", () => {
    const styled = buildDraftOverlayEvents([title], colors, FRAME, { style: STYLE });
    expect(styled.filter((line) => line.includes(",OverlayShape,")).map((line) => line.match(/\\p1\}m (\d+ \d+)/)?.[1])).toEqual(["136 214", "136 200", "136 200"]);
    const plain = buildDraftOverlayEvents([title], colors, FRAME);
    expect(plain.filter((line) => line.includes(",OverlayShape,"))).toHaveLength(1);
    expect(buildDraftOverlayEvents([search], colors, FRAME, { style: { ...STYLE, shadow: "none", border: "none" } })[0]).toContain("m 140 600 l 860 600");
  });

  it("draws a keyword's card at the style's corner with its shadow and border, and at the kind's own without a style", () => {
    const keyword = overlay({ kind: "keyword", text: "Hanoi", side: "left", fontSize: 60, box: { left: 100, top: 300, width: 400, height: 100 } });
    const card = getDrawnOverlayCard(keyword) as { left: number; top: number };
    const shapes = (events: string[]) => events.filter((line) => line.includes(",OverlayShape,"));
    const styled = shapes(buildDraftOverlayEvents([keyword], colors, FRAME, { style: STYLE }));
    expect(styled).toHaveLength(3);
    expect(styled[1]).toContain(`m ${String(card.left + 36)} ${String(card.top)} `);
    const plain = shapes(buildDraftOverlayEvents([keyword], colors, FRAME));
    expect(plain).toHaveLength(1);
    expect(plain[0]).toContain(`m ${String(card.left + 25)} ${String(card.top)} `);
  });

  it("writes the style into the render's card CSS and an overlay's own corner inline", () => {
    const markup = getOverlayMarkup([{ ...title, cornerRadius: "s" } as ResolvedOverlay], { colors, headingFont: "Head", frame: FRAME, style: STYLE });
    expect(markup.css).toContain(".ov-card{border-radius:36px;box-shadow:0 14px 44px rgba(0,0,0,0.4);border:3px solid #ff8800}");
    expect(markup.css).toContain(".ov-search{border-radius:999px}");
    expect(markup.css).toContain(".ov-keyword .ov-card{border-bottom:.12em solid #ff8800}");
    expect(markup.html.join("")).toContain(' style="border-radius:12px"');
    const borderless = getOverlayMarkup([title], { colors, headingFont: "Head", frame: FRAME, style: { ...STYLE, border: "none" } });
    expect(borderless.css.some((rule) => rule.startsWith(".ov-keyword .ov-card{border-bottom") && rule.endsWith("#ff8800}"))).toBe(false);
    expect(getOverlayMarkup([title], { colors, headingFont: "Head", frame: FRAME }).css.some((rule) => rule.includes("border:3px"))).toBe(false);
  });

  it("writes the caption pill's rule in the style", () => {
    expect(getStyledPillCss({ ...STYLE, padding: "l", captionCornerRadius: "pill" }, "#ff8800")).toBe(".pill{border-radius:999px;padding:22px 38px;box-shadow:0 14px 44px rgba(0,0,0,0.4);border:3px solid #ff8800}");
  });
});

describe("an overlay's own corner_radius", () => {
  it("is taken by a card kind and refused by a kind that draws no card", () => {
    expect(overlaySchema.safeParse({ kind: "keyword", at: 1, duration: 2, text: "Hi", style: { corner_radius: "pill" } }).success).toBe(true);
    const refused = overlaySchema.safeParse({ kind: "arrow", at: 1, duration: 2, anchor: { x: 10, y: 10 }, style: { corner_radius: "s" } });
    expect(refused.success ? [] : refused.error.issues.map((issue) => issue.message)).toEqual(["an arrow draws no card; leave corner_radius out"]);
  });
});
