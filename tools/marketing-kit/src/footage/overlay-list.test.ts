import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import { readEdl, type Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { getOverlayMarkup } from "./overlay-html.js";
import { OVERLAY_EASES } from "./overlay-motion.js";
import { OVERLAY_LIST_LAYOUTS, type EdlOverlay } from "./overlay-schema.js";
import {
  LIST_CHIP_GAP_EM,
  OVERLAY_LINE_HEIGHT,
  OVERLAY_LIST_LINE_HEIGHT,
  estimateTextWidth,
  getChipBadgeSize,
  getChipCoveredTimes,
  getChipParts,
  getDrawnOverlayCard,
  getListCardsByItem,
  getListItemTimes,
  getListStops,
  getOverlayPadding,
  getSideTextLines,
  resolveEdlOverlays,
  type OverlayBox,
  type ResolveOverlaysInput,
  type ResolvedOverlay,
  LIST_CHIP_MIN_FONT_SIZE,
  LIST_CHIP_CENTRED_MIN_FONT_SIZE,
} from "./overlays.js";
import { readFfmpegListing } from "./tools.js";

/** RV-144 of an adopting app: the list card centred and growing with each point, short points as chips side by side. */

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
  endCard: null,
};
const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const COLORS = { background: "#1d1a2b", foreground: "#fdf7f2", accent: "#e8336b" };
const STYLE = { cornerRadius: "m", shadow: "none", border: "none", padding: "m" } as const;
const SEGMENTS: Edl["segments"] = [{ id: "s1", clip: "talk", start: 0, end: 20, transition: "cut", motion: "none" }];
const WORDS = [
  { text: "price", start: 2.4, end: 2.7 },
  { text: "days", start: 3.1, end: 3.5 },
  { text: "office", start: 4.2, end: 4.6 },
  { text: "visa", start: 5, end: 5.3 },
];
const edlWith = (overlays: EdlOverlay[]): Edl => ({ version: 2, film: "trip", segments: SEGMENTS, overlays });

/** Three short points, said one by one. */
const SHORT: EdlOverlay = { kind: "list", at: 2, duration: 4, items: ["35 zl", "3 days", "town hall"], item_words: [{ text: "price" }, { text: "days" }, { text: "office" }] };
/** Four short points, said one by one (RV-185 of an adopting app: the shown chips stay centred while the row fills). */
const FOUR: EdlOverlay = { kind: "list", at: 2, duration: 4, items: ["35 zl", "3 days", "town hall", "visa"], item_words: [{ text: "price" }, { text: "days" }, { text: "office" }, { text: "visa" }] };
/** A list with a long point: too wide for one row of chips at size l. */
const LONG: EdlOverlay = { kind: "list", at: 2, duration: 4, items: ["Visa", "Thirty days on arrival, no fee", "Passport"], item_words: [{ text: "price" }, { text: "days" }, { text: "office" }], style: { size: "l" } };

function resolve(overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}) {
  return resolveEdlOverlays({ film, edl: edlWith(overlays), words: WORDS, frame: FRAME, caption: CAPTION, ...changes });
}

function list(overlay: EdlOverlay, changes: Partial<ResolveOverlaysInput> = {}): Extract<ResolvedOverlay, { kind: "list" }> {
  const result = resolve([overlay], changes);
  if (!result.ok) throw new Error(result.problems.join("; "));
  const [first] = result.overlays;
  if (first?.kind !== "list") throw new Error("expected a list");
  return first;
}

/** How far the middle of a group of boxes sits from the frame's vertical axis, in per cent of the frame's width. */
const getAxisOffsetPercent = (boxes: readonly OverlayBox[]): number => {
  const left = Math.min(...boxes.map((box) => box.left));
  const right = Math.max(...boxes.map((box) => box.left + box.width));
  return (Math.abs((left + right) / 2 - FRAME.width / 2) / FRAME.width) * 100;
};

const withLayout = (overlay: EdlOverlay, layout: (typeof OVERLAY_LIST_LAYOUTS)[number]): EdlOverlay => ({ ...overlay, style: { ...overlay.style, list_layout: layout } });

function markup(overlays: EdlOverlay[]): { html: string; tweens: string[] } {
  const result = resolve(overlays, { style: STYLE });
  if (!result.ok) throw new Error(result.problems.join("; "));
  const out = getOverlayMarkup(result.overlays, { colors: COLORS, headingFont: "Cal", frame: FRAME, style: STYLE });
  return { html: out.html.join(""), tweens: out.tweens };
}

function draft(overlays: EdlOverlay[], style: typeof STYLE | null = STYLE): string[] {
  const result = resolve(overlays, style === null ? {} : { style });
  if (!result.ok) throw new Error(result.problems.join("; "));
  const ass = buildFootageDraftCaptions({ film, edl: edlWith(overlays), words: WORDS, caption: CAPTION, frame: FRAME, overlays: result.overlays, overlayColors: COLORS, ...(style === null ? {} : { style }) });
  return (ass ?? "").split("\n").filter((line) => line.startsWith("Dialogue:"));
}

describe("the list layout's schema", () => {
  it("takes stack, chips and auto on a list", () => {
    for (const layout of OVERLAY_LIST_LAYOUTS) expect(readEdl(edlWith([withLayout(SHORT, layout)])).ok).toBe(true);
  });

  it("refuses a layout on another kind and a layout it does not know", () => {
    const keyword = readEdl(edlWith([{ kind: "keyword", at: 1, duration: 2, text: "3x", style: { list_layout: "chips" } }]));
    expect(keyword.ok ? "" : keyword.error).toBe("overlays.0.style.list_layout: only a list lays out points; leave list_layout out");
    const unknown = readEdl({ ...edlWith([]), overlays: [{ ...SHORT, style: { list_layout: "grid" } }] });
    expect(unknown.ok).toBe(false);
  });
});

describe("placing a list", () => {
  it("centres a stack without a side, its lines without bullets, its card in the middle of the box", () => {
    const stack = list({ ...SHORT, style: { stagger: true } });
    expect(stack.isCentred).toBe(true);
    expect(stack.chips).toBeUndefined();
    expect(getSideTextLines(stack)).toEqual(["35 zl", "3 days", "town hall"]);
    const card = getDrawnOverlayCard(stack) as OverlayBox;
    const width = estimateTextWidth("town hall", 48) + 2 * getOverlayPadding(stack).x;
    expect(card).toEqual({ left: stack.box.left + Math.round((stack.box.width - width) / 2), top: stack.box.top, width, height: stack.box.height });
  });

  it("keeps a list with a side on that side, with its bullets", () => {
    const right = list({ ...SHORT, style: { side: "right" } });
    expect(right.isCentred).toBeUndefined();
    expect(getSideTextLines(right)[0]).toBe("• 35 zl");
    const card = getDrawnOverlayCard(right) as OverlayBox;
    expect(card.left + card.width).toBe(right.box.left + right.box.width);
  });

  it("lays chips out left to right in one row centred on the frame, each fitted to its point", () => {
    const chips = list(withLayout(SHORT, "chips"));
    const size = chips.fontSize;
    const pad = getOverlayPadding(chips);
    // Each chip holds its step badge before its point (RV-181 of an adopting app).
    const badge = getChipBadgeSize(size);
    const widths = chips.items.map((item) => Math.ceil(estimateTextWidth(item, size) + pad.y + pad.x + badge.size + badge.gap));
    const gap = Math.round(size * LIST_CHIP_GAP_EM);
    const row = widths.reduce((sum, width) => sum + width, 0) + 2 * gap;
    const height = Math.ceil(size * OVERLAY_LINE_HEIGHT + 2 * pad.y);
    // The row fits the 792 px centred on the frame (the wider side, 120 px, and the margin on both edges).
    expect(row).toBeLessThanOrEqual(1080 - 2 * (120 + 24));
    const left = Math.round((FRAME.width - row) / 2);
    expect(chips.box.height).toBe(height);
    expect(chips.chips).toEqual([
      { left, top: chips.box.top, width: widths[0], height },
      { left: left + (widths[0] as number) + gap, top: chips.box.top, width: widths[1], height },
      { left: left + (widths[0] as number) + (widths[1] as number) + 2 * gap, top: chips.box.top, width: widths[2], height },
    ]);
    // The drawn card a report reads (does it cover a face?) is the row's box.
    expect(getDrawnOverlayCard(chips)).toEqual({ left, top: chips.box.top, width: row, height });
    expect(getSideTextLines(chips)).toEqual(["35 zl", "3 days", "town hall"]);
  });

  it("draws a row that fits the zone only off the axis a little smaller, so it sits on the frame's axis", () => {
    // RV-185 of an adopting app: three points at size l in the safe zone whose sides differ most (`all`) stood at 11 % to
    // 83.9 % of the width, a row too wide for the centred span at the chips' smallest type.
    const wide = { film: { ...film, captions: true, captionPreset: "all" as const } };
    const chips = list(withLayout({ ...SHORT, items: ["medication", "date", "who gave it"], style: { size: "l" } }, "chips"), wide);
    expect(chips.fontSize).toBeLessThan(LIST_CHIP_MIN_FONT_SIZE);
    expect(chips.fontSize).toBeGreaterThanOrEqual(LIST_CHIP_CENTRED_MIN_FONT_SIZE);
    for (const step of getListCardsByItem(chips)) expect(getAxisOffsetPercent(step)).toBeLessThanOrEqual(0.1);
  });

  it("draws chips smaller, as a title shrinks, when the row fits only so", () => {
    const wide: EdlOverlay = { ...SHORT, items: ["35 zl", "3 days", "county office"] };
    const chips = list(withLayout(wide, "auto"));
    // At 48 px the row is wider than the 792 px centred on the frame; steps of 0.9 bring it under, never three past.
    expect(chips.fontSize).toBeLessThan(list(withLayout(SHORT, "chips")).fontSize);
    expect(chips.fontSize).toBeGreaterThanOrEqual(Math.round(48 * 0.9 ** 3) - 1);
    expect(chips.chips).toHaveLength(3);
    const card = getDrawnOverlayCard(chips) as OverlayBox;
    expect(card.width).toBeLessThanOrEqual(792);
    expect(card.left + card.width / 2).toBeCloseTo(540, -0.5);
    expect(chips.box.height).toBe(Math.ceil(chips.fontSize * OVERLAY_LINE_HEIGHT + 2 * getOverlayPadding(chips).y));
  });

  it("draws a row of badged chips that fitted one row before their badges, smaller still rather than refusing it", () => {
    // Three points at size l in the widest safe zone: 822 px of room, the row too wide after three shrinks with its badges.
    const points: EdlOverlay = { kind: "list", at: 2, duration: 4, items: ["vaccine", "date", "who signed"], style: { size: "l", list_layout: "chips" } };
    const chips = list(points, { film: { ...film, captionPreset: "all" } });
    expect(chips.chips).toHaveLength(3);
    // Past the three shrinks a title takes (56 px to 41 px), yet never under the smallest chip size.
    expect(chips.fontSize).toBeLessThan(Math.round(56 * 0.9 ** 3));
    expect(chips.fontSize).toBeGreaterThanOrEqual(LIST_CHIP_MIN_FONT_SIZE);
    const card = getDrawnOverlayCard(chips) as OverlayBox;
    expect(card.width).toBeLessThanOrEqual(822);
    expect(card.left + card.width / 2).toBeCloseTo(540, -0.5);
  });

  it("refuses badged chips that stay too wide at the smallest chip size", () => {
    const points: EdlOverlay = { kind: "list", at: 2, duration: 4, items: ["the vaccine and its batch", "the date it was given", "who signed"], style: { size: "l", list_layout: "chips" } };
    const result = resolve([points], { film: { ...film, captionPreset: "all" } });
    expect(result.ok ? [] : result.problems).toEqual([expect.stringMatching(/^overlays\[0\]: the list's points as chips \(\d+ px\) do not fit one row \(822 px\) even at a smaller size;/)]);
  });

  it("takes chips on auto when every point fits one row, else the centred stack", () => {
    expect(list(withLayout(SHORT, "auto")).chips).toHaveLength(3);
    const long = list(withLayout(LONG, "auto"));
    expect(long.chips).toBeUndefined();
    expect(long.isCentred).toBe(true);
    expect(long.box.height).toBe(Math.ceil(3 * 56 * OVERLAY_LIST_LINE_HEIGHT + 2 * getOverlayPadding(long).y));
  });

  it("refuses chips that do not fit one row, naming both widths and the way out", () => {
    const result = resolve([withLayout(LONG, "chips")]);
    expect(result.ok ? [] : result.problems).toEqual([
      "overlays[0]: the list's points as chips (1760 px) do not fit one row (852 px) even at a smaller size; use list_layout stack or auto, or shorter points",
    ]);
  });

  it("draws a stack on stack, whatever its points' widths", () => {
    expect(list(withLayout(SHORT, "stack")).chips).toBeUndefined();
  });
});

describe("a list's points over time", () => {
  it("brings the first point in with the card, the rest on their words, or every point with the card unstaggered", () => {
    expect(getListItemTimes(list(SHORT))).toEqual([2, 3.1, 4.2]);
    expect(getListItemTimes(list({ ...SHORT, item_words: undefined }))).toEqual([2, 2, 2]);
    // An item_at the caller resolved: the first second is the card's, whatever was asked.
    expect(list({ ...SHORT, item_words: undefined, item_at: [2.5, 3, 4] }).itemStarts).toEqual([2, 3, 4]);
  });

  it("grows a centred stack's card point by point, wider and taller, about its middle, never past the whole list's card", () => {
    const stack = list(SHORT);
    const cards = getListCardsByItem(stack).map((boxes) => boxes[0] as OverlayBox);
    const pad = getOverlayPadding(stack);
    expect(cards.map((card) => card.height)).toEqual([1, 2].map((lines) => Math.ceil(lines * 48 * OVERLAY_LIST_LINE_HEIGHT + 2 * pad.y)).concat(stack.box.height));
    expect(cards.map((card) => card.width)).toEqual(["35 zl", "3 days", "town hall"].map((text) => estimateTextWidth(text, 48) + 2 * pad.x));
    const middles = cards.map((card) => card.left + card.width / 2);
    for (const middle of middles) expect(Math.abs(middle - (stack.box.left + stack.box.width / 2))).toBeLessThanOrEqual(0.5);
    expect(cards[2]).toEqual(getDrawnOverlayCard(stack));
  });

  it("grows a stack on the right side from its right edge", () => {
    const cards = getListCardsByItem(list({ ...SHORT, style: { side: "right" } })).map((boxes) => boxes[0] as OverlayBox);
    expect(new Set(cards.map((card) => card.left + card.width)).size).toBe(1);
  });

  it("adds one chip at a time, the chips shown so far a row of their own on the frame's axis, the last step the full row", () => {
    for (const overlay of [SHORT, FOUR]) {
      const chips = list(withLayout(overlay, "chips"));
      const full = chips.chips as OverlayBox[];
      const steps = getListCardsByItem(chips);
      expect(steps.map((step) => step.length)).toEqual(full.map((_chip, index) => index + 1));
      // RV-185 of an adopting app: one chip alone used to stand where the full row starts, left of the axis.
      for (const step of steps) expect(getAxisOffsetPercent(step)).toBeLessThanOrEqual(0.1);
      // Each step keeps the chips' sizes, order and gaps; only the row's place moves.
      for (const step of steps) {
        const shift = (step[0] as OverlayBox).left - (full[0] as OverlayBox).left;
        expect(step).toEqual(full.slice(0, step.length).map((chip) => ({ ...chip, left: chip.left + shift })));
      }
      // Stability: with every point in, the row is exactly today's.
      expect(steps.at(-1)).toEqual(full);
    }
  });

  it("names one step per distinct second: points on the same second come in together", () => {
    expect(getListStops(list(withLayout(SHORT, "chips")))).toEqual([
      { at: 2, step: 0 },
      { at: 3.1, step: 1 },
      { at: 4.2, step: 2 },
    ]);
    expect(getListStops(list(withLayout({ ...SHORT, item_words: undefined, item_at: [2, 3, 3] }, "chips")))).toEqual([
      { at: 2, step: 0 },
      { at: 3, step: 2 },
    ]);
    expect(getListStops(list(withLayout({ ...FOUR, item_words: [{ text: "price" }, { text: "days" }, { text: "days" }, { text: "visa" }] }, "chips")))).toEqual([
      { at: 2, step: 0 },
      { at: 3.1, step: 2 },
      { at: 5, step: 3 },
    ]);
  });

  it("keeps a list that does not fit one row of chips (auto) a centred stack on the frame's axis at every step", () => {
    const stack = list(withLayout(LONG, "auto"));
    expect(stack.chips).toBeUndefined();
    for (const step of getListCardsByItem(stack)) expect(getAxisOffsetPercent(step)).toBeLessThanOrEqual(0.1);
  });
});

describe("the render's list", () => {
  it("starts a stack's card at its first point's size and eases it to each next one as the point comes in", () => {
    const stack = list(SHORT, { style: STYLE });
    const cards = getListCardsByItem(stack).map((boxes) => boxes[0] as OverlayBox);
    const { html, tweens } = markup([SHORT]);
    expect(html).toContain(`<div id="ov0" class="clip ov ov-list center"`);
    expect(html).toContain(`<ul class="ov-card grow cen" style="width:${cards[0]?.width}px;height:${cards[0]?.height}px;padding:17px 29px">`);
    expect(html).toContain('<li id="ov0i0">35 zl</li><li id="ov0i1" style="opacity:0">3 days</li><li id="ov0i2" style="opacity:0">town hall</li>');
    expect(tweens.filter((tween) => tween.includes("width:"))).toEqual([
      `tl.to("#ov0 .ov-card", { width: ${cards[1]?.width}, height: ${cards[1]?.height}, duration: 0.35, ease: "power3.out" }, 3.1);`,
      `tl.to("#ov0 .ov-card", { width: ${cards[2]?.width}, height: ${cards[2]?.height}, duration: 0.35, ease: "power3.out" }, 4.2);`,
    ]);
    // The card enters with its first point: the soft pill, eased out, never past its size.
    expect(tweens[0]).toBe('tl.fromTo("#ov0 .ov-card", { scale: 0.88, y: 18, opacity: 0 }, { scale: 1, y: 0, opacity: 1, duration: 0.45, ease: "power3.out", immediateRender: false }, 2);');
    expect(tweens.join("\n")).not.toMatch(/back|elastic|bounce/);
  });

  it("draws an unstaggered stack whole from its start, and a list on a side with its dots", () => {
    const { html, tweens } = markup([{ ...SHORT, item_words: undefined, style: { side: "left", entrance: "pop" } }]);
    expect(html).toContain('<div id="ov0" class="clip ov ov-list"');
    expect(html).toContain('<ul class="ov-card grow"');
    expect(html).toContain('<li id="ov0i1"><i class="ov-dot"></i>3 days</li>');
    expect(tweens.some((tween) => tween.includes("width:") || tween.includes("#ov0i"))).toBe(false);
    expect(tweens[0]).toContain('tl.fromTo("#ov0 .ov-card", { opacity: 0, scale: 0.92 }');
  });

  it("draws chips as cards of their own, the later ones hidden until their second, then entering in turn", () => {
    const chips = list(withLayout(SHORT, "chips"), { style: STYLE });
    const steps = getListCardsByItem(chips);
    // Each chip starts at its place in the row it joins (RV-185 of an adopting app): the first alone on the axis.
    const first = steps[0]?.[0] as OverlayBox;
    const { html, tweens } = markup([withLayout({ ...SHORT, style: { entrance: "wipe" } }, "chips")]);
    expect(html).toContain('<div id="ov0" class="clip ov ov-list chips"');
    const pad = getOverlayPadding(chips);
    const badge = getChipBadgeSize(chips.fontSize);
    expect(html).toContain(
      `<div class="ov-card ov-chip" id="ov0c0" style="left:${first.left - chips.box.left}px;top:0px;width:${first.width}px;height:${first.height}px;padding:${pad.y}px ${pad.x}px ${pad.y}px ${pad.y}px"><i class="ov-wipe" id="ov0w0"></i><b class="ov-num" style="width:${badge.size}px;height:${badge.size}px"><i id="ov0n0">1</i><svg viewBox="0 0 ${badge.size} ${badge.size}"><polyline id="ov0k0"`,
    );
    // The last chip is never covered: its number stays, no tick.
    expect(html).toContain('<i id="ov0n2">3</i></b><span id="ov0t2">town hall</span>');
    expect(html).not.toContain('id="ov0k2"');
    // Each point steps back when the next one comes in: fainter, its number giving way to a drawn tick (RV-181).
    expect(tweens.filter((tween) => tween.includes("#ov0t") || tween.includes("#ov0n") || tween.includes("#ov0k"))).toEqual([
      'tl.to("#ov0t0", { opacity: 0.55, duration: 0.3, ease: "power2.out" }, 3.1);',
      'tl.to("#ov0n0", { opacity: 0, duration: 0.12, ease: "none" }, 3.1);',
      'tl.fromTo("#ov0k0", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.3, ease: "power2.out", immediateRender: false }, 3.18);',
      'tl.to("#ov0t1", { opacity: 0.55, duration: 0.3, ease: "power2.out" }, 4.2);',
      'tl.to("#ov0n1", { opacity: 0, duration: 0.12, ease: "none" }, 4.2);',
      'tl.fromTo("#ov0k1", { attr: { "stroke-dashoffset": 1 } }, { attr: { "stroke-dashoffset": 0 }, duration: 0.3, ease: "power2.out", immediateRender: false }, 4.28);',
    ]);
    expect(html).toContain(`id="ov0c1" style="left:${(steps[1]?.[1]?.left ?? 0) - chips.box.left}px;`);
    expect(html).toContain(`id="ov0c2" style="left:${(chips.chips?.[2]?.left ?? 0) - chips.box.left}px;`);
    // As each point comes in, the chips shown ease aside to their places in the wider row, as a stack's card grows.
    const slide = (chip: number, step: number, at: number) => `tl.to("#ov0c${chip}", { left: ${(steps[step]?.[chip]?.left ?? 0) - chips.box.left}, duration: 0.35, ease: "power3.out" }, ${at});`;
    expect(tweens.filter((tween) => tween.includes("{ left:"))).toEqual([slide(0, 1, 3.1), slide(0, 2, 4.2), slide(1, 2, 4.2)]);
    expect(html.match(/visibility:hidden/g)).toHaveLength(2);
    expect(tweens.filter((tween) => tween.startsWith("tl.set("))).toEqual(['tl.set("#ov0c1", { visibility: "visible" }, 3.1);', 'tl.set("#ov0c2", { visibility: "visible" }, 4.2);']);
    expect(tweens.filter((tween) => tween.includes('clipPath: "inset(0% 100% 0% 0%)"')).map((tween) => tween.slice(0, 18))).toEqual(['tl.fromTo("#ov0c0"', 'tl.fromTo("#ov0c1"', 'tl.fromTo("#ov0c2"']);
    // Every chip leaves together, wiped off.
    expect(tweens.at(-1)).toBe('tl.to("#ov0 .ov-card", { clipPath: "inset(0% 0% 0% 100%)", duration: 0.3, ease: "power2.in" }, 5.7);');
  });

  it("gives each chip the soft pill on its own second without an entrance, and its own colours", () => {
    const { html, tweens } = markup([withLayout({ ...SHORT, style: { colors: { card: "#00ff00" } } }, "chips")]);
    expect(html).toContain(";background:#00ff00");
    expect(tweens.filter((tween) => tween.includes("scale: 0.88")).map((tween) => tween.match(/"(#ov0c\d)".*, ([\d.]+)\);$/)?.slice(1))).toEqual([
      ["#ov0c0", "2"],
      ["#ov0c1", "3.1"],
      ["#ov0c2", "4.2"],
    ]);
  });
});

describe("a list's points in the order they are said (RV-192 of an adopting app)", () => {
  /** "long" is said once before the list (an opening question) and twice after it starts; "where" and "risks" once. */
  const SAID = [
    { text: "How", start: 0.3, end: 0.5 },
    { text: "long", start: 0.6, end: 0.9 },
    { text: "where", start: 2, end: 2.3 },
    { text: "long", start: 2.8, end: 3 },
    { text: "risks", start: 3.6, end: 3.9 },
    { text: "long", start: 4.4, end: 4.6 },
  ];
  const ASKED: EdlOverlay = { kind: "list", at: 2, duration: 4, items: ["where?", "how long?", "risks?"], item_words: [{ text: "where" }, { text: "long" }, { text: "risks" }], style: { list_layout: "chips" } };
  const said = (overlay: EdlOverlay) => list(overlay, { words: SAID, style: STYLE });

  it("takes a point's word said after the list starts, not the same word said before it", () => {
    // Before the fix "long" took the opening question's word (0.6 s), so its chip came in with the first one at 2 s.
    expect(getListItemTimes(said(ASKED))).toEqual([2, 2.8, 3.6]);
  });

  it("counts a point's occurrence from the list's start", () => {
    const second = { ...ASKED, item_words: [{ text: "where" }, { text: "risks" }, { text: "long", occurrence: 2 }] };
    expect(getListItemTimes(said(second))).toEqual([2, 3.6, 4.4]);
  });

  it("keeps a word said only before the list on the list's start, as before, rather than refusing the list", () => {
    const early = { ...ASKED, item_words: [{ text: "where" }, { text: "How" }, { text: "risks" }] };
    expect(getListItemTimes(said(early))).toEqual([2, 2, 3.6]);
    // An occurrence the list never reaches still counts over the whole cut, as before.
    const third = { ...ASKED, item_words: [{ text: "where" }, { text: "long", occurrence: 3 }, { text: "risks" }] };
    // ("long" is said three times in all: the third is 4.4 s, and the point after it waits for it.)
    expect(getListItemTimes(said(third))).toEqual([2, 4.4, 4.4]);
  });

  it("still refuses a point's word the cut never says", () => {
    const result = resolve([{ ...ASKED, item_words: [{ text: "where" }, { text: "visa" }, { text: "risks" }] }], { words: SAID });
    expect(result).toEqual({ ok: false, problems: ['overlays[0].item_words[1]: no word "visa" in the cut; the film never says it'] });
  });

  it("never brings a point in before the one ahead of it", () => {
    expect(list({ ...SHORT, item_words: undefined, item_at: [2, 4, 3] }).itemStarts).toEqual([2, 4, 4]);
  });

  it("ticks every point before the one that leads, in order, even after two came in together", () => {
    const base = said(ASKED);
    expect(getChipCoveredTimes(base)).toEqual([2.8, 3.6, null]);
    expect(getChipCoveredTimes({ ...base, itemStarts: [2, 2, 3.6] })).toEqual([3.6, 3.6, null]);
    expect(getChipCoveredTimes({ ...base, itemStarts: [2, 3.6, 3.6] })).toEqual([3.6, null, null]);
    // A next point the list never reaches covers nothing.
    expect(getChipCoveredTimes({ ...base, itemStarts: [2, 2.8, 6] })).toEqual([2.8, null, null]);
  });

  /** The draft's events of one layer and style showing at `at` seconds, as [start, text]. */
  function showing(lines: readonly string[], layer: string, style: string, at: number): string[] {
    const seconds = (time: string) => time.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
    return lines.filter((line) => {
      const [, start = "", end = ""] = line.split(",");
      return line.startsWith(`Dialogue: ${layer},`) && line.includes(`,${style},`) && seconds(start.trim()) <= at && at < seconds(end.trim());
    });
  }

  it("brings each chip in on its own word in the draft, one at a time, every earlier one ticked and the newest leading", () => {
    const overlay = resolve([ASKED], { words: SAID, style: STYLE });
    if (!overlay.ok) throw new Error(overlay.problems.join("; "));
    const ass = buildFootageDraftCaptions({ film, edl: edlWith([ASKED]), words: SAID, caption: CAPTION, frame: FRAME, overlays: overlay.overlays, overlayColors: COLORS, style: STYLE }) ?? "";
    const lines = ass.split("\n").filter((line) => line.startsWith("Dialogue:"));
    const FRAME_SECONDS = 1 / 30;
    [2, 2.8, 3.6].forEach((word, point) => {
      // Just before the word: only the chips said so far; one frame after: one more, the newest.
      expect(showing(lines, "5", "OverlayShape", word - FRAME_SECONDS)).toHaveLength(point);
      expect(showing(lines, "5", "OverlayShape", word + FRAME_SECONDS)).toHaveLength(point + 1);
      // The newest shows its number; every chip before it its tick, none its number.
      const numbers = showing(lines, "6", "OverlayPlain", word + FRAME_SECONDS);
      expect(numbers.map((line) => line.slice(-1))).toEqual([String(point + 1)]);
      expect(showing(lines, "6", "OverlayShape", word + 0.4)).toHaveLength(point);
    });
  });

  it("brings each chip in on its own word in the render, and draws the ticks in order", () => {
    const result = resolve([ASKED], { words: SAID, style: STYLE });
    if (!result.ok) throw new Error(result.problems.join("; "));
    const { tweens } = getOverlayMarkup(result.overlays, { colors: COLORS, headingFont: "Cal", frame: FRAME, style: STYLE });
    expect(tweens.filter((tween) => tween.startsWith("tl.set("))).toEqual(['tl.set("#ov0c1", { visibility: "visible" }, 2.8);', 'tl.set("#ov0c2", { visibility: "visible" }, 3.6);']);
    expect(tweens.filter((tween) => tween.includes("#ov0n")).map((tween) => tween.slice(-6))).toEqual([" 2.8);", " 3.6);"]);
  });
});

describe("the draft's list", () => {
  it("draws a stack's card from its first point's size, easing to each next one, its lines centred on the card's axis", () => {
    const stack = list(SHORT, { style: STYLE });
    const cards = getListCardsByItem(stack).map((boxes) => boxes[0] as OverlayBox);
    const lines = draft([SHORT], null);
    const shapes = lines.filter((line) => line.startsWith("Dialogue: 3,"));
    expect(shapes.map((line) => line.slice(12, 34))).toEqual([
      "0:00:02.00,0:00:03.10,",
      "0:00:03.10,0:00:03.22,",
      "0:00:03.22,0:00:03.33,",
      "0:00:03.33,0:00:04.20,",
      "0:00:04.20,0:00:04.32,",
      "0:00:04.32,0:00:04.43,",
      "0:00:04.43,0:00:06.00,",
    ]);
    // The first takes the entrance, the last the exit; the steps between neither.
    expect(shapes[0]).toContain("\\fad(150,0)");
    expect(shapes[3]).not.toContain("\\fad");
    expect(shapes[6]).toContain("\\fad(0,250)");
    const widthOf = (line: string) => {
      const xs = [...(line.split("\\p1}")[1] ?? "").matchAll(/(-?\d+) (-?\d+)/g)].map((match) => Number(match[1]));
      return Math.max(...xs) - Math.min(...xs);
    };
    const widths = shapes.map(widthOf);
    expect(widths[0]).toBe(cards[0]?.width);
    expect(widths[3]).toBe(cards[1]?.width);
    expect(widths[6]).toBe(cards[2]?.width);
    // Growing only: no step is wider than the next (no overshoot), and the eased step is past the halfway mark.
    for (let index = 1; index < widths.length; index++) expect(widths[index] as number).toBeGreaterThanOrEqual(widths[index - 1] as number);
    const eased = OVERLAY_EASES["power3.out"](1 / 3);
    expect(widths[1]).toBe(Math.round((cards[0]?.width as number) + ((cards[1]?.width as number) - (cards[0]?.width as number)) * eased));
    const texts = lines.filter((line) => line.startsWith("Dialogue: 4,"));
    const axis = Math.round((cards[2]?.left as number) + (cards[2]?.width as number) / 2);
    expect(texts.map((line) => line.slice(12, 34))).toEqual(["0:00:02.00,0:00:06.00,", "0:00:03.10,0:00:06.00,", "0:00:04.20,0:00:06.00,"]);
    for (const text of texts) expect(text).toContain("\\an8\\fs48");
    for (const text of texts) expect(text).toContain(`\\pos(${axis},`);
    expect(texts[0]?.endsWith("}35 zl")).toBe(true);
    // A later point shows only inside the card as it grows to it, as the render's card clips it.
    const rect = (box: OverlayBox) => `\\clip(${box.left},${box.top},${box.left + box.width},${box.top + box.height})`;
    expect(texts[0]).not.toContain("\\clip");
    expect(texts[1]).toContain(`${rect(cards[0] as OverlayBox)}\\t(0,350,0.4,${rect(cards[1] as OverlayBox)})`);
    expect(texts[2]).toContain(`${rect(cards[1] as OverlayBox)}\\t(0,350,0.4,${rect(cards[2] as OverlayBox)})`);
    // A wipe off clips the points itself.
    const wiped = draft([{ ...SHORT, style: { entrance: "wipe" } }], null).filter((line) => line.startsWith("Dialogue: 4,"));
    expect(wiped[1]).not.toContain("\\t(0,350,0.4,");
  });

  it("draws an unstaggered stack as one card with every line in from its start, on its side with the brand's style", () => {
    const lines = draft([{ ...SHORT, item_words: undefined, style: { side: "left" } }]);
    const shapes = lines.filter((line) => line.startsWith("Dialogue: 3,"));
    expect(new Set(shapes.map((line) => line.slice(12, 34)))).toEqual(new Set(["0:00:02.00,0:00:06.00,"]));
    const texts = lines.filter((line) => line.startsWith("Dialogue: 4,"));
    expect(texts.map((line) => line.slice(12, 34))).toEqual(["0:00:02.00,0:00:06.00,", "0:00:02.00,0:00:06.00,", "0:00:02.00,0:00:06.00,"]);
    expect(texts[1]).toContain("\\an7\\fs48");
    expect(texts[1]?.endsWith("}• 3 days")).toBe(true);
  });

  it("puts a right-side stack's lines against its right padding", () => {
    const texts = draft([{ ...SHORT, style: { side: "right" } }], null).filter((line) => line.startsWith("Dialogue: 4,"));
    for (const text of texts) expect(text).toContain("\\an9\\fs48");
  });

  it("draws each chip and its point from the chip's own second, the point centred in it, easing aside as later points come in", () => {
    const chips = list(withLayout(SHORT, "chips"), { style: STYLE });
    const steps = getListCardsByItem(chips);
    const lines = draft([withLayout(SHORT, "chips")], null);
    const times = (layer: string) => lines.filter((line) => line.startsWith(layer)).map((line) => line.slice(12, 34));
    // RV-185 of an adopting app: each chip stands still between the points, and slides in three eased steps (as a
    // stack's card grows) when a later point comes in; the third, the last in, never moves.
    const first = ["0:00:02.00,0:00:03.10,", "0:00:03.10,0:00:03.22,", "0:00:03.22,0:00:03.33,", "0:00:03.33,0:00:04.20,", "0:00:04.20,0:00:04.32,", "0:00:04.32,0:00:04.43,", "0:00:04.43,0:00:06.00,"];
    const second = ["0:00:03.10,0:00:04.20,", "0:00:04.20,0:00:04.32,", "0:00:04.32,0:00:04.43,", "0:00:04.43,0:00:06.00,"];
    const third = ["0:00:04.20,0:00:06.00,"];
    expect(times("Dialogue: 3,")).toEqual([...first, ...second, ...third]);
    const shapes = lines.filter((line) => line.startsWith("Dialogue: 3,"));
    // Only a chip's first part fades in, only its last fades out: no blink between the parts.
    expect(shapes.map((line) => line.match(/\\fad\((\d+),(\d+)\)/)?.slice(1).join(",") ?? "")).toEqual(["150,0", "", "", "", "", "", "0,250", "150,0", "", "", "0,250", "150,250"]);
    // A chip's point: leading on its first part, fainter on every part after the next point is in (RV-181).
    const texts = lines.filter((line) => line.startsWith("Dialogue: 4,"));
    expect(texts.map((line) => line.slice(12, 34))).toEqual([...first, ...second, ...third]);
    expect(texts.map((line) => line.includes("\\1a&H73&"))).toEqual([false, true, true, true, true, true, true, false, true, true, true, false]);
    const pad = getOverlayPadding(chips);
    const at = (chip: OverlayBox) => `\\an8\\fs${chips.fontSize}\\pos(${Math.round(getChipParts(chip, chips).textX)},${chip.top + pad.y})`;
    // Each chip's text starts at its place in the row it joins and ends at its place in the full row.
    expect(texts[0]).toContain(at(steps[0]?.[0] as OverlayBox));
    expect(texts[3]).toContain(at(steps[1]?.[0] as OverlayBox));
    expect(texts[6]).toContain(at(chips.chips?.[0] as OverlayBox));
    expect(texts[7]).toContain(at(steps[1]?.[1] as OverlayBox));
    expect(texts[10]).toContain(at(chips.chips?.[1] as OverlayBox));
    expect(texts[11]).toContain(at(chips.chips?.[2] as OverlayBox));
    // Each step of a slide lies between the two places, eased out (most of the way after the first step).
    const xOf = (line: string) => Number(line.match(/\\pos\((\d+),/)?.[1]);
    const [from, to] = [xOf(texts[0] as string), xOf(texts[3] as string)];
    const share = (xOf(texts[1] as string) - from) / (to - from);
    expect(share).toBeGreaterThan(0.5);
    expect(share).toBeLessThan(1);
    // Each chip's badge: an accent mark on every part (layer 5), its number while it leads, a tick from the next point's
    // second, carried along the slide.
    expect(times("Dialogue: 5,")).toEqual([...first, ...second, ...third]);
    const numbers = lines.filter((line) => line.startsWith("Dialogue: 6,") && line.includes("OverlayPlain"));
    expect(numbers.map((line) => [line.slice(12, 34), line.slice(-1)])).toEqual([
      ["0:00:02.00,0:00:03.10,", "1"],
      ["0:00:03.10,0:00:04.20,", "2"],
      ["0:00:04.20,0:00:06.00,", "3"],
    ]);
    const ticks = lines.filter((line) => line.startsWith("Dialogue: 6,") && line.includes("OverlayShape"));
    expect(ticks.map((line) => line.slice(12, 34))).toEqual([...first.slice(1), ...second.slice(1)]);
    // The tick draws in from the next point's second; a later part picks it up as far as it has come, then holds it.
    expect(ticks[0]).toMatch(/\\clip\((\d+),(\d+),\1,(\d+)\)\\t\(0,300,/);
    expect(ticks[1]).toMatch(/\\t\(0,183,/);
    expect(ticks[2]).toMatch(/\\t\(0,67,/);
    expect(ticks[3]).not.toContain("\\t(");
    expect(ticks[5]).toContain("\\fad(0,250)");
    expect(ticks[4]).not.toContain("\\fad");
  });

  it("slides the shown chips once when two points come in on the same second, and never past the list's end", () => {
    const overlay = withLayout({ ...SHORT, item_words: undefined, item_at: [2, 3, 3] }, "chips");
    const chips = list(overlay, { style: STYLE });
    const lines = draft([overlay], null);
    const shapes = lines.filter((line) => line.startsWith("Dialogue: 3,")).map((line) => line.slice(12, 34));
    expect(shapes).toEqual([
      "0:00:02.00,0:00:03.00,",
      "0:00:03.00,0:00:03.12,",
      "0:00:03.12,0:00:03.23,",
      "0:00:03.23,0:00:06.00,",
      "0:00:03.00,0:00:06.00,",
      "0:00:03.00,0:00:06.00,",
    ]);
    // The two points that come in together start in the full row; only the first chip moves, once.
    const { html, tweens } = markup([overlay]);
    expect(html).toContain(`id="ov0c1" style="left:${(chips.chips?.[1]?.left ?? 0) - chips.box.left}px;`);
    expect(tweens.filter((tween) => tween.includes("{ left:"))).toEqual([`tl.to("#ov0c0", { left: ${(chips.chips?.[0]?.left ?? 0) - chips.box.left}, duration: 0.35, ease: "power3.out" }, 3);`]);
    // A point that would come in only as the list ends (a list resolved elsewhere) moves nothing, in either path.
    const late = { ...chips, itemStarts: [2, 3, 6] };
    const out = getOverlayMarkup([late], { colors: COLORS, headingFont: "Cal", frame: FRAME, style: STYLE });
    expect(out.tweens.filter((tween) => tween.includes("{ left:"))).toEqual([`tl.to("#ov0c0", { left: ${(getListCardsByItem(late)[1]?.[0]?.left ?? 0) - chips.box.left}, duration: 0.35, ease: "power3.out" }, 3);`]);
    const ass = buildFootageDraftCaptions({ film, edl: edlWith([overlay]), words: WORDS, caption: CAPTION, frame: FRAME, overlays: [late], overlayColors: COLORS }) ?? "";
    expect(ass.split("\n").filter((line) => line.startsWith("Dialogue: 3,")).map((line) => line.slice(12, 34))).toEqual([
      "0:00:02.00,0:00:03.00,",
      "0:00:03.00,0:00:03.12,",
      "0:00:03.12,0:00:03.23,",
      "0:00:03.23,0:00:06.00,",
      "0:00:03.00,0:00:06.00,",
    ]);
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("a list burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function grab(overlays: EdlOverlay[], seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "list-")) : dir;
    const result = resolve(overlays, { style: STYLE });
    if (!result.ok) throw new Error(result.problems.join("; "));
    const ass = buildFootageDraftCaptions({ film, edl: edlWith(overlays), words: WORDS, caption: CAPTION, frame: FRAME, overlays: result.overlays, overlayColors: COLORS, style: STYLE });
    writeFileSync(join(dir, "o.ass"), ass ?? "");
    mkdirSync(join(dir, "fonts"), { recursive: true });
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(dir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${FRAME.width}x${FRAME.height}:d=10:r=30`, "-ss", String(seconds), "-vf", "ass=o.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: FRAME.width * FRAME.height * 3 + 1024 },
    );
    expect(run.status, run.stderr.toString()).toBe(0);
    return run.stdout;
  }

  /** Whether a pixel is near a colour. */
  function isNear(frame: Buffer, x: number, y: number, hex: string): boolean {
    const at = (y * FRAME.width + x) * 3;
    return [1, 3, 5].every((offset, channel) => Math.abs((frame[at + channel] ?? 0) - parseInt(hex.slice(offset, offset + 2), 16)) <= 40);
  }

  /** The columns of a row of the frame where the card's colour is drawn: its first and last. */
  function getCardSpan(frame: Buffer, y: number): { left: number; right: number } | null {
    const xs = Array.from({ length: FRAME.width }, (_x, x) => x).filter((x) => isNear(frame, x, y, COLORS.background));
    return xs.length === 0 ? null : { left: xs[0] as number, right: xs[xs.length - 1] as number };
  }

  /** How many pixels of a box are in the text's colour. */
  function countText(frame: Buffer, box: OverlayBox): number {
    let found = 0;
    for (let y = box.top; y < box.top + box.height; y++) for (let x = box.left; x < box.left + box.width; x++) if (isNear(frame, x, y, COLORS.foreground)) found++;
    return found;
  }

  it("shows short points as chips appearing in turn, the chips shown always centred on the frame's axis", () => {
    // RV-185 of an adopting app: frames with 1, 2, 3 (and 4) chips in, once each slide has settled.
    for (const [points, seconds] of [
      [SHORT, [2.6, 3.6, 4.7]],
      [FOUR, [2.6, 3.6, 4.7, 5.6]],
    ] as const) {
      const overlay = withLayout(points, "chips");
      const resolved = list(overlay, { style: STYLE });
      const steps = getListCardsByItem(resolved);
      seconds.forEach((second, step) => {
        const shown = steps[step] as OverlayBox[];
        const middle = (shown[0] as OverlayBox).top + Math.round((shown[0] as OverlayBox).height / 2);
        const span = getCardSpan(grab([overlay], second), middle) as { left: number; right: number };
        const last = shown[shown.length - 1] as OverlayBox;
        expect(Math.abs(span.left - (shown[0] as OverlayBox).left)).toBeLessThanOrEqual(3);
        expect(Math.abs(span.right - (last.left + last.width))).toBeLessThanOrEqual(3);
        expect(Math.abs((span.left + span.right) / 2 - FRAME.width / 2)).toBeLessThanOrEqual(FRAME.width * 0.01);
      });
    }
  });

  it("slides the shown chips aside as the next one comes in, with no jump, the newest leading", () => {
    const overlay = withLayout(SHORT, "chips");
    const resolved = list(overlay, { style: STYLE });
    const steps = getListCardsByItem(resolved);
    const middle = resolved.box.top + Math.round(resolved.box.height / 2);
    const leftAt = (second: number) => (getCardSpan(grab([overlay], second), middle) as { left: number }).left;
    // Before, during and after the second point comes in at 3.1 s: the first chip's left edge moves left by steps.
    const [before, during, after] = [leftAt(3.0), leftAt(3.2), leftAt(3.6)];
    expect(Math.abs(before - (steps[0]?.[0]?.left ?? 0))).toBeLessThanOrEqual(3);
    expect(Math.abs(after - (steps[1]?.[0]?.left ?? 0))).toBeLessThanOrEqual(3);
    expect(during).toBeLessThan(before);
    expect(during).toBeGreaterThan(after);
    // The newest point leads in full colour; the covered ones step back (fainter text), as a countdown does (RV-181).
    const lit = (second: number, step: number) => (steps[step] as OverlayBox[]).map((chip) => countText(grab([overlay], second), chip));
    const [early, late] = [lit(2.6, 0), lit(4.7, 2)];
    expect(early[0]).toBeGreaterThan(50);
    expect(late[2]).toBeGreaterThan(50);
    expect(late[0]).toBeLessThan((early[0] as number) / 4);
  });

  it("shows a long list as a centred stack whose card grows with each point and never stands empty", () => {
    const stack = list(LONG, { style: STYLE });
    const cards = getListCardsByItem(stack).map((boxes) => boxes[0] as OverlayBox);
    const row = (index: number) => Math.round(stack.box.top + getOverlayPadding(stack).y + (index + 0.5) * 56 * OVERLAY_LIST_LINE_HEIGHT);
    const seen = [2.6, 3.8, 4.9].map((second) => {
      const frame = grab([LONG], second);
      return { first: getCardSpan(frame, row(0)), third: getCardSpan(frame, row(2)) };
    });
    // After the first point only its card shows, sized to it, in the middle; the third row is still the picture.
    expect(seen[0]?.third).toBeNull();
    const firstWidth = (seen[0]?.first?.right ?? 0) - (seen[0]?.first?.left ?? 0);
    expect(Math.abs(firstWidth - (cards[0] as OverlayBox).width)).toBeLessThanOrEqual(FRAME.width * 0.02);
    // Then it widens to the long point and grows down to the third.
    const secondWidth = (seen[1]?.first?.right ?? 0) - (seen[1]?.first?.left ?? 0);
    expect(Math.abs(secondWidth - (cards[1] as OverlayBox).width)).toBeLessThanOrEqual(FRAME.width * 0.02);
    expect(seen[1]?.third).toBeNull();
    expect(seen[2]?.third).not.toBeNull();
    const middle = stack.box.left + stack.box.width / 2;
    for (const step of seen) expect(Math.abs(((step.first?.left ?? 0) + (step.first?.right ?? 0)) / 2 - middle)).toBeLessThanOrEqual(FRAME.width * 0.02);
  });
});

/** RV-187 of an adopting app: a list stays until its last point is said, the 8 s counted from that point. */
describe("a list's seconds counted from its last point", () => {
  /** A list whose points are said slowly: the last at 10.4 s, 8.4 s after the list's start. */
  const SLOW_WORDS = [
    { text: "vaccine", start: 2.2, end: 2.6 },
    { text: "date", start: 6, end: 6.3 },
    { text: "who", start: 10.4, end: 10.6 },
  ];
  const SLOW: EdlOverlay = { kind: "list", at: 2, duration: 10, items: ["vaccine", "date", "who"], item_words: [{ text: "vaccine" }, { text: "date" }, { text: "who" }], style: { list_layout: "chips" } };
  const slow = (overlay: EdlOverlay) => resolve([overlay], { words: SLOW_WORDS });

  it("reads a list with points past 8 s, and still refuses any other overlay past 8 s", () => {
    expect(readEdl(edlWith([SLOW])).ok).toBe(true);
    expect(readEdl(edlWith([{ ...SLOW, item_words: undefined, item_at: [2, 6, 10.4] }])).ok).toBe(true);
    const unpointed = readEdl(edlWith([{ ...SLOW, item_words: undefined, style: { stagger: true } }]));
    expect(unpointed.ok ? "" : unpointed.error).toBe("overlays.0.duration: a list stays at most 8 s (only a hook_title stays longer)");
  });

  it("shows every point of a slowly said list, the last one on its word", () => {
    const result = slow(SLOW);
    if (!result.ok) throw new Error(result.problems.join("; "));
    expect(getListItemTimes(result.overlays[0] as Extract<ResolvedOverlay, { kind: "list" }>)).toEqual([2, 6, 10.4]);
  });

  it("keeps a list up to 8 s after its last point is said, and refuses it a moment longer", () => {
    // The last point at 10.4 s: the list may end at 18.4 s, 16.4 s after its start.
    expect(slow({ ...SLOW, duration: 16.4 }).ok).toBe(true);
    expect(slow({ ...SLOW, duration: 16.5 })).toEqual({
      ok: false,
      problems: ["overlays[0]: a list stays at most 8 s after its last point (said at 10.4 s); it ends at 18.5 s, 8.1 s after it"],
    });
  });

  it("counts the 8 s from the last point of item_at too", () => {
    const timed: EdlOverlay = { ...SLOW, item_words: undefined, item_at: [2, 6, 10.4] };
    expect(resolve([{ ...timed, duration: 16.4 }]).ok).toBe(true);
    expect(resolve([{ ...timed, duration: 16.5 }]).ok).toBe(false);
  });

  it("counts from the list's start when every point is said with it, as before", () => {
    const quick: EdlOverlay = { ...SLOW, duration: 8, item_words: undefined, item_at: [2, 2, 2] };
    expect(resolve([quick]).ok).toBe(true);
    expect(resolve([{ ...quick, duration: 8.1 }])).toEqual({
      ok: false,
      problems: ["overlays[0]: a list stays at most 8 s after its last point (said at 2 s); it ends at 10.1 s, 8.1 s after it"],
    });
  });
});
