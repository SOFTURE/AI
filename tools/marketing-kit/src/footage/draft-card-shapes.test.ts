import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import type { BrandFont } from "../config/config.js";
import { readFontTables } from "../og/font-tables.js";
import { createOverlayTextMeasure, FOOTAGE_DRAFT_FONT, loadFootageDraftFonts, type FootageDraftFonts } from "./draft.js";
import { buildDraftOverlayEvents, getRoundedRectDrawing } from "./draft-overlays.js";
import { createDraftFont, DEFAULT_CONTENT_AREA, getSpacingWidth } from "./draft-text-width.js";
import type { Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { HAND_FONT } from "./hand-font.js";
import type { EdlOverlay } from "./overlay-schema.js";
import {
  COUNTER_UNIT_GAP_EM,
  estimateTextWidth,
  formatOverlayNumber,
  getCounterCard,
  getDrawnOverlayCard,
  getKeywordMarkBlock,
  getOverlayPadding,
  getSideTextLayout,
  getTitleContentBox,
  KEYWORD_EDGE_EM,
  MARK_PADDING_EM,
  MARK_RADIUS_EM,
  OVERLAY_DOT_EM,
  OVERLAY_LETTER_SPACING_EM,
  OVERLAY_LINE_HEIGHT,
  resolveEdlOverlays,
  type OverlayTextMeasure,
  type ResolvedOverlay,
} from "./overlays.js";

/** RV-194 of an adopting app: the draft draws every overlay card in the render's size and shape, and reports it. */

const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const COLORS = { background: "#101820", foreground: "#f2f3f5", accent: "#ff3d7f" };
/** The accent as an ASS fill tag (`&HBBGGRR&`). */
const ACCENT_TAG = "\\1c&H7F3DFF&";

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
  captions: false,
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

function resolveOne<K extends ResolvedOverlay["kind"]>(overlay: EdlOverlay & { kind: K }): Extract<ResolvedOverlay, { kind: K }> {
  const [resolved] = resolve([overlay]);
  if (resolved?.kind !== overlay.kind) throw new Error(`a ${overlay.kind}`);
  return resolved as Extract<ResolvedOverlay, { kind: K }>;
}

/** Half an em a character, plus the letter spacing: easy widths to check by hand. */
const HALF_EM: OverlayTextMeasure = (_role, text, cssPx, spacingEm) => [...text].length * cssPx * 0.5 + getSpacingWidth(text, spacingEm, cssPx);

const fonts = (): FootageDraftFonts => loadFootageDraftFonts({ body: BODY, heading: HEADING });
const draw = (overlays: ResolvedOverlay[], set = fonts()): string[] => buildDraftOverlayEvents(overlays, COLORS, FRAME, { fonts: { heading: set.heading.family }, drawnFonts: set });

const KEYWORD = "booklet = yellow fever certificate of vaccination";

describe("getSideTextLayout", () => {
  it("fits a keyword on one line: its card as wide as its text plus padding, its accent edge under it, hanging from the box's top", () => {
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: "3x", style: { side: "left" } });
    const layout = getSideTextLayout(keyword, HALF_EM);
    const pad = getOverlayPadding(keyword);
    const text = HALF_EM("heading", "3x", keyword.fontSize, OVERLAY_LETTER_SPACING_EM.card);
    expect(layout.lines).toEqual(["3x"]);
    expect(layout.card).toEqual({
      left: keyword.box.left,
      top: keyword.box.top,
      width: Math.ceil(text + 2 * pad.x),
      height: Math.ceil(keyword.fontSize * OVERLAY_LINE_HEIGHT + 2 * pad.y + Math.round(keyword.fontSize * KEYWORD_EDGE_EM)),
    });
    expect(layout.textX).toBe(keyword.box.left + pad.x);
    expect(layout.textTop).toBe(keyword.box.top + pad.y);
    expect(layout.dot).toBeNull();
  });

  it("sets a right keyword's card at the box's right and a centred one in its middle", () => {
    const right = resolveOne({ kind: "keyword", at: 0, duration: 3, text: "3x", style: { side: "right" } });
    const card = getSideTextLayout(right, HALF_EM).card;
    expect(card.left + card.width).toBe(right.box.left + right.box.width);
    const centred = resolveOne({ kind: "keyword", at: 0, duration: 3, text: "3x", style: { align: "center" } });
    const layout = getSideTextLayout(centred, HALF_EM);
    expect(layout.card.left).toBe(centred.box.left + Math.round((centred.box.width - layout.card.width) / 2));
    expect(layout.textX).toBe(layout.card.left + layout.card.width / 2);
  });

  it("wraps a long keyword inside its box: the card takes the whole box and one CSS line per line", () => {
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: KEYWORD });
    const layout = getSideTextLayout(keyword, HALF_EM);
    const pad = getOverlayPadding(keyword);
    expect(layout.lines.length).toBeGreaterThan(1);
    expect(layout.lines.join(" ")).toBe(KEYWORD);
    const room = keyword.box.width - 2 * pad.x;
    for (const line of layout.lines) expect(HALF_EM("heading", line, keyword.fontSize, OVERLAY_LETTER_SPACING_EM.card)).toBeLessThanOrEqual(room);
    expect(layout.card.width).toBe(keyword.box.width);
    expect(layout.card.height).toBe(Math.ceil(layout.lines.length * keyword.fontSize * OVERLAY_LINE_HEIGHT + 2 * pad.y + Math.round(keyword.fontSize * KEYWORD_EDGE_EM)));
  });

  it("stands a lower third on its box's foot, its dot first and its text after the dot's gap", () => {
    const lower = resolveOne({ kind: "lower_third", at: 0, duration: 3, text: "Travel clinic" });
    const layout = getSideTextLayout(lower, HALF_EM);
    const pad = getOverlayPadding(lower);
    const dot = lower.fontSize * (OVERLAY_DOT_EM.size + OVERLAY_DOT_EM.gap);
    expect(layout.card.top + layout.card.height).toBe(lower.box.top + lower.box.height);
    expect(layout.card.height).toBe(Math.ceil(lower.fontSize * OVERLAY_LINE_HEIGHT + 2 * pad.y));
    expect(layout.card.width).toBe(Math.ceil(HALF_EM("interface", "Travel clinic", lower.fontSize, OVERLAY_LETTER_SPACING_EM.card) + dot + 2 * pad.x));
    expect(layout.textX).toBe(lower.box.left + pad.x + dot);
    expect(layout.dot).toEqual({ centre: { x: lower.box.left + pad.x + (lower.fontSize * OVERLAY_DOT_EM.size) / 2, y: layout.card.top + layout.card.height / 2 }, radius: (lower.fontSize * OVERLAY_DOT_EM.size) / 2 });
  });

  it("gives a highlighted keyword no edge and its mark's padding round the text", () => {
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: "3x", style: { backdrop: "highlight", side: "left" } });
    const layout = getSideTextLayout(keyword, HALF_EM);
    const pad = getOverlayPadding(keyword);
    const mark = { x: keyword.fontSize * MARK_PADDING_EM.x, y: keyword.fontSize * MARK_PADDING_EM.y };
    expect(layout.card.height).toBe(Math.ceil(keyword.fontSize * OVERLAY_LINE_HEIGHT + 2 * mark.y + 2 * pad.y));
    expect(layout.card.width).toBe(Math.ceil(HALF_EM("heading", "3x", keyword.fontSize, OVERLAY_LETTER_SPACING_EM.card) + 2 * mark.x + 2 * pad.x));
    expect(layout.textX).toBe(keyword.box.left + pad.x + mark.x);
    expect(layout.textTop).toBe(keyword.box.top + pad.y + mark.y);
  });
});

describe("getKeywordMarkBlock", () => {
  it("is one block round the keyword's text: its width on one line, the card's room once it wraps", () => {
    const short = resolveOne({ kind: "keyword", at: 0, duration: 3, text: "3x", style: { backdrop: "highlight" } });
    const one = getSideTextLayout(short, HALF_EM);
    const mark = { x: short.fontSize * MARK_PADDING_EM.x, y: short.fontSize * MARK_PADDING_EM.y };
    expect(getKeywordMarkBlock(short, one, one.lines, HALF_EM)).toEqual({
      left: one.textX - mark.x,
      top: one.textTop - mark.y,
      width: HALF_EM("heading", "3x", short.fontSize, OVERLAY_LETTER_SPACING_EM.card) + 2 * mark.x,
      height: short.fontSize * OVERLAY_LINE_HEIGHT + 2 * mark.y,
    });
    const long = resolveOne({ kind: "keyword", at: 0, duration: 3, text: KEYWORD, style: { backdrop: "highlight" } });
    const wrapped = getSideTextLayout(long, HALF_EM);
    const block = getKeywordMarkBlock(long, wrapped, wrapped.lines, HALF_EM);
    expect(block.width).toBe(wrapped.card.width - 2 * getOverlayPadding(long).x);
    expect(block.height).toBeCloseTo(wrapped.lines.length * long.fontSize * OVERLAY_LINE_HEIGHT + 2 * long.fontSize * MARK_PADDING_EM.y, 9);
  });

  it("centres a centred keyword's block on its text's axis", () => {
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: "3x", style: { backdrop: "highlight", align: "center" } });
    const layout = getSideTextLayout(keyword, HALF_EM);
    const block = getKeywordMarkBlock(keyword, layout, layout.lines, HALF_EM);
    expect(block.left + block.width / 2).toBeCloseTo(layout.textX, 9);
  });
});

describe("getCounterCard", () => {
  it("fits the number, the gap and the unit plus padding, in the middle of the box from its top", () => {
    const counter = resolveOne({ kind: "counter", at: 0, duration: 3, value: 2800, unit: "PLN" });
    const pad = getOverlayPadding(counter);
    const number = HALF_EM("heading", "2,800", counter.fontSize, OVERLAY_LETTER_SPACING_EM.card);
    const unit = HALF_EM("heading", "PLN", counter.unitFontSize, (OVERLAY_LETTER_SPACING_EM.card * counter.fontSize) / counter.unitFontSize);
    const width = Math.ceil(number + counter.fontSize * COUNTER_UNIT_GAP_EM + unit + 2 * pad.x);
    expect(getCounterCard(counter, "2,800", HALF_EM)).toEqual({
      left: counter.box.left + Math.round((counter.box.width - width) / 2),
      top: counter.box.top,
      width,
      height: Math.ceil(counter.fontSize * OVERLAY_LINE_HEIGHT + 2 * pad.y),
    });
  });

  it("grows with the number it shows and needs no gap without a unit", () => {
    const counter = resolveOne({ kind: "counter", at: 0, duration: 3, value: 2800 });
    const pad = getOverlayPadding(counter);
    expect(getCounterCard(counter, "0", HALF_EM).width).toBe(Math.ceil(HALF_EM("heading", "0", counter.fontSize, OVERLAY_LETTER_SPACING_EM.card) + 2 * pad.x));
    expect(getCounterCard(counter, "2,800", HALF_EM).width).toBeGreaterThan(getCounterCard(counter, "0", HALF_EM).width);
  });
});

describe("getDrawnOverlayCard", () => {
  it("answers as before without a measure: a side text's estimated card as tall as its box", () => {
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: KEYWORD });
    const pad = getOverlayPadding(keyword);
    expect(getDrawnOverlayCard(keyword)).toEqual({ left: keyword.box.left, top: keyword.box.top, width: Math.min(keyword.box.width, Math.ceil(estimateTextWidth(KEYWORD, keyword.fontSize) + 2 * pad.x)), height: keyword.box.height });
    const counter = resolveOne({ kind: "counter", at: 0, duration: 3, value: 2800, unit: "PLN" });
    expect(getDrawnOverlayCard(counter)).toEqual(counter.box);
  });

  it("answers the render's card with a measure: a side text's layout, a counter at its final value", () => {
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: KEYWORD });
    expect(getDrawnOverlayCard(keyword, HALF_EM)).toEqual(getSideTextLayout(keyword, HALF_EM).card);
    const lower = resolveOne({ kind: "lower_third", at: 0, duration: 3, text: "Travel clinic" });
    expect(getDrawnOverlayCard(lower, HALF_EM)).toEqual(getSideTextLayout(lower, HALF_EM).card);
    const counter = resolveOne({ kind: "counter", at: 0, duration: 3, value: 2800, from: 0, unit: "PLN" });
    expect(getDrawnOverlayCard(counter, HALF_EM)).toEqual(getCounterCard(counter, formatOverlayNumber(2800, counter.decimals, "en-US"), HALF_EM));
    const place = resolveOne({ kind: "place_card", at: 0, duration: 3, text: "Thailand" });
    expect(getDrawnOverlayCard(place, HALF_EM)).toEqual(place.box);
  });

  it("answers where a highlight's marks show: a keyword's block, a hook title's widest line (a named place: its box)", () => {
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: KEYWORD, style: { backdrop: "highlight" } });
    const layout = getSideTextLayout(keyword, HALF_EM);
    expect(getDrawnOverlayCard(keyword, HALF_EM)).toEqual(getKeywordMarkBlock(keyword, layout, layout.lines, HALF_EM));
    const hook = resolveOne({ kind: "hook_title", at: 0, duration: 3, text: "What vaccines cost before a long trip", style: { backdrop: "highlight" } });
    const content = getTitleContentBox(hook);
    const width = Math.max(...hook.lines.map((line) => HALF_EM("heading", line, hook.fontSize, OVERLAY_LETTER_SPACING_EM.hookTitle))) + 2 * hook.fontSize * MARK_PADDING_EM.x;
    expect(getDrawnOverlayCard(hook, HALF_EM)).toEqual({ left: content.left + content.width / 2 - width / 2, top: content.top, width, height: content.height });
    const left = resolveOne({ kind: "hook_title", at: 0, duration: 3, text: "What vaccines cost", style: { backdrop: "highlight", align: "left" } });
    expect(getDrawnOverlayCard(left, HALF_EM)?.left).toBe(getTitleContentBox(left).left);
    const placed = resolveOne({ kind: "hook_title", at: 0, duration: 3, text: "What vaccines cost", place: "Warsaw", style: { backdrop: "highlight" } });
    expect(getDrawnOverlayCard(placed, HALF_EM)).toEqual(placed.box);
  });
});

describe("createOverlayTextMeasure and the fonts' content area", () => {
  it("measures each role in its own font, its letters spaced", () => {
    const set = fonts();
    const measure = createOverlayTextMeasure(set);
    expect(measure("heading", "Thailand", 96, -0.025)).toBe(set.heading.measure("Thailand", 96) + getSpacingWidth("Thailand", -0.025, 96));
    expect(measure("interface", "Thailand", 96, 0)).toBe(set.interface.measure("Thailand", 96));
  });

  it("reads a font's content area from hhea, or its typo metrics when it asks for them", () => {
    const data = readFileSync(FOOTAGE_DRAFT_FONT.file);
    const font = createDraftFont({ family: "DejaVu Sans", file: FOOTAGE_DRAFT_FONT.file }, data);
    const tables = readFontTables(data);
    if (!tables.ok) throw new Error("readable");
    const hhea = tables.value.get("hhea") as Buffer;
    const head = tables.value.get("head") as Buffer;
    const unitsPerEm = head.readUInt16BE(18);
    expect(font?.contentArea).toEqual({ ascentEm: hhea.readInt16BE(4) / unitsPerEm, descentEm: -hhea.readInt16BE(6) / unitsPerEm });
    const copy = Buffer.from(data);
    const os2 = readFontTables(copy);
    if (!os2.ok) throw new Error("readable");
    const table = os2.value.get("OS/2") as Buffer;
    table.writeUInt16BE(table.readUInt16BE(62) | (1 << 7), 62);
    table.writeInt16BE(1500, 68);
    table.writeInt16BE(-500, 70);
    expect(createDraftFont({ family: "DejaVu Sans", file: FOOTAGE_DRAFT_FONT.file }, copy)?.contentArea).toEqual({ ascentEm: 1500 / unitsPerEm, descentEm: 500 / unitsPerEm });
  });
});

describe("buildDraftOverlayEvents laid out as the render", () => {
  /** The drawings (`\\p1}…{\\p0`) of the events that contain `tag`. */
  const drawings = (events: readonly string[], tag: string): string[] => events.filter((event) => event.includes(tag)).map((event) => /\\p1\}(.*)\{\\p0\}/.exec(event)?.[1] ?? "");

  it("draws a lower third's accent dot and its text after it", () => {
    const set = fonts();
    const lower = resolveOne({ kind: "lower_third", at: 0, duration: 3, text: "Travel clinic" });
    const layout = getSideTextLayout(lower, createOverlayTextMeasure(set));
    const events = draw([lower], set);
    expect(events.some((event) => event.startsWith("Dialogue: 4,") && event.includes(ACCENT_TAG) && event.includes("\\p1}m "))).toBe(true);
    expect(events.join("\n")).toContain(`\\pos(${String(Math.round(layout.textX))},${String(Math.round(layout.textTop))})`);
  });

  it("draws a keyword's accent edge under its fill, and none under an underlined one", () => {
    const set = fonts();
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: "3x" });
    const card = getSideTextLayout(keyword, createOverlayTextMeasure(set)).card;
    const events = draw([keyword], set);
    const accent = events.findIndex((event) => event.includes(ACCENT_TAG) && event.startsWith("Dialogue: 3,"));
    const fill = events.findIndex((event) => event.includes("\\1c&H201810&") && event.startsWith("Dialogue: 3,"));
    expect(accent).toBeGreaterThanOrEqual(0);
    expect(accent).toBeLessThan(fill);
    expect(drawings([events[fill] as string], "\\1c&H201810&")[0]).toBe(getRoundedRectDrawing({ ...card, height: card.height - Math.round(keyword.fontSize * KEYWORD_EDGE_EM) }, keyword.fontSize * 0.42));
    const underlined = draw([resolveOne({ kind: "keyword", at: 0, duration: 3, text: "3x", style: { underline: true } })], set);
    expect(underlined.filter((event) => event.startsWith("Dialogue: 3,") && event.includes(ACCENT_TAG))).toHaveLength(0);
  });

  it("draws a highlighted keyword's one block mark round its wrapped lines", () => {
    const set = fonts();
    const measure = createOverlayTextMeasure(set);
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: KEYWORD, style: { backdrop: "highlight" } });
    const layout = getSideTextLayout(keyword, measure);
    expect(layout.lines.length).toBeGreaterThan(1);
    const marks = drawings(draw([keyword], set), "\\1c&H201810&");
    expect(marks).toEqual([getRoundedRectDrawing(getKeywordMarkBlock(keyword, layout, layout.lines, measure), keyword.fontSize * MARK_RADIUS_EM)]);
  });

  it("grows a typed highlighted keyword's block with its letters", () => {
    const set = fonts();
    const keyword = resolveOne({ kind: "keyword", at: 0, duration: 3, text: "Hi you", style: { backdrop: "highlight", entrance: "type" } });
    const marks = drawings(draw([keyword], set), "\\1c&H201810&");
    // One block a typed letter: H, Hi, Hi (the space), Hi y, Hi yo, Hi you.
    expect(marks).toHaveLength(6);
    expect(new Set(marks).size).toBe(5);
  });

  it("sizes a highlighted hook title's marks to each line's text and its font's content area", () => {
    const set = fonts();
    const measure = createOverlayTextMeasure(set);
    const hook = resolveOne({ kind: "hook_title", at: 0, duration: 3, text: "What vaccines cost before a long trip", style: { backdrop: "highlight" } });
    const content = getTitleContentBox(hook);
    const area = set.heading.contentArea ?? DEFAULT_CONTENT_AREA;
    const contentHeight = hook.fontSize * (area.ascentEm + area.descentEm);
    const pad = { x: hook.fontSize * MARK_PADDING_EM.x, y: hook.fontSize * MARK_PADDING_EM.y };
    const expected = hook.lines.map((line, index) => {
      const width = measure("heading", line, hook.fontSize, OVERLAY_LETTER_SPACING_EM.hookTitle) + 2 * pad.x;
      const top = content.top + index * hook.fontSize * OVERLAY_LINE_HEIGHT + (hook.fontSize * OVERLAY_LINE_HEIGHT - contentHeight) / 2 - pad.y;
      return getRoundedRectDrawing({ left: content.left + content.width / 2 - width / 2, top, width, height: contentHeight + 2 * pad.y }, hook.fontSize * MARK_RADIUS_EM);
    });
    expect(drawings(draw([hook], set), "\\1c&H201810&")).toEqual(expected);
  });

  it("pushes a left highlighted hook title's text in by its mark's padding", () => {
    const set = fonts();
    const hook = resolveOne({ kind: "hook_title", at: 0, duration: 3, text: "What vaccines cost", style: { backdrop: "highlight", align: "left", entrance: "fade" } });
    const content = getTitleContentBox(hook);
    expect(draw([hook], set).join("\n")).toContain(`\\pos(${String(Math.round(content.left + hook.fontSize * MARK_PADDING_EM.x))},`);
  });

  it("draws a counter's card with each width its number takes, the last its final value's", () => {
    const set = fonts();
    const counter = resolveOne({ kind: "counter", at: 0, duration: 3, value: 2800, from: 0, unit: "PLN" });
    const final = getCounterCard(counter, formatOverlayNumber(2800, counter.decimals, "en-US"), createOverlayTextMeasure(set));
    const cards = drawings(draw([counter], set), "\\1c&H201810&");
    // A card a run of one width: each differs from the one before it.
    expect(cards.every((card, index) => index === 0 || card !== cards[index - 1])).toBe(true);
    expect(cards.length).toBeGreaterThan(2);
    expect(cards.at(-1)).toBe(getRoundedRectDrawing(final, counter.fontSize * 0.42));
  });

  it("keeps the estimated cards without the draft's fonts (as before): no dot, a one-line keyword card", () => {
    const lower = resolveOne({ kind: "lower_third", at: 0, duration: 3, text: "Travel clinic" });
    const events = buildDraftOverlayEvents([lower], COLORS, FRAME);
    expect(events.some((event) => event.startsWith("Dialogue: 4,") && event.includes(ACCENT_TAG))).toBe(false);
  });
});
