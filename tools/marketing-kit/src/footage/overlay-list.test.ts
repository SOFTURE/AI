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
  getDrawnOverlayCard,
  getListCardsByItem,
  getListItemTimes,
  getOverlayPadding,
  getSideTextLines,
  resolveEdlOverlays,
  type OverlayBox,
  type ResolveOverlaysInput,
  type ResolvedOverlay,
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
];
const edlWith = (overlays: EdlOverlay[]): Edl => ({ version: 2, film: "trip", segments: SEGMENTS, overlays });

/** Three short points, said one by one. */
const SHORT: EdlOverlay = { kind: "list", at: 2, duration: 4, items: ["35 zl", "3 days", "county office"], item_words: [{ text: "price" }, { text: "days" }, { text: "office" }] };
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
    expect(getSideTextLines(stack)).toEqual(["35 zl", "3 days", "county office"]);
    const card = getDrawnOverlayCard(stack) as OverlayBox;
    const width = estimateTextWidth("county office", 48) + 2 * getOverlayPadding(stack).x;
    expect(card).toEqual({ left: stack.box.left + Math.round((stack.box.width - width) / 2), top: stack.box.top, width, height: stack.box.height });
  });

  it("keeps a list with a side on that side, with its bullets", () => {
    const right = list({ ...SHORT, style: { side: "right" } });
    expect(right.isCentred).toBeUndefined();
    expect(getSideTextLines(right)[0]).toBe("• 35 zl");
    const card = getDrawnOverlayCard(right) as OverlayBox;
    expect(card.left + card.width).toBe(right.box.left + right.box.width);
  });

  it("lays chips out left to right in one row centred in the box, each fitted to its point", () => {
    const chips = list(withLayout(SHORT, "chips"));
    const pad = getOverlayPadding(chips);
    const widths = chips.items.map((item) => estimateTextWidth(item, 48) + 2 * pad.x);
    const gap = Math.round(48 * LIST_CHIP_GAP_EM);
    const row = widths.reduce((sum, width) => sum + width, 0) + 2 * gap;
    const height = Math.ceil(48 * OVERLAY_LINE_HEIGHT + 2 * pad.y);
    const left = chips.box.left + Math.round((chips.box.width - row) / 2);
    expect(chips.box.height).toBe(height);
    expect(chips.chips).toEqual([
      { left, top: chips.box.top, width: widths[0], height },
      { left: left + (widths[0] as number) + gap, top: chips.box.top, width: widths[1], height },
      { left: left + (widths[0] as number) + (widths[1] as number) + 2 * gap, top: chips.box.top, width: widths[2], height },
    ]);
    // The drawn card a report reads (does it cover a face?) is the row's box.
    expect(getDrawnOverlayCard(chips)).toEqual({ left, top: chips.box.top, width: row, height });
    expect(getSideTextLines(chips)).toEqual(["35 zl", "3 days", "county office"]);
  });

  it("draws chips smaller, as a title shrinks, when the row fits only so", () => {
    const wide: EdlOverlay = { ...SHORT, items: ["35 zl", "3 days", "county land office"] };
    const chips = list(withLayout(wide, "auto"));
    // At 48 px the row is wider than the 852 px of room; two steps of 0.9 bring it to 39 px.
    expect(chips.fontSize).toBe(39);
    expect(chips.chips).toHaveLength(3);
    const card = getDrawnOverlayCard(chips) as OverlayBox;
    expect(card.width).toBeLessThanOrEqual(chips.box.width);
    expect(chips.box.height).toBe(Math.ceil(39 * OVERLAY_LINE_HEIGHT + 2 * getOverlayPadding(chips).y));
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
      "overlays[0]: the list's points as chips (1556 px) do not fit one row (852 px) even at a smaller size; use list_layout stack or auto, or shorter points",
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
    expect(cards.map((card) => card.width)).toEqual(["35 zl", "3 days", "county office"].map((text) => estimateTextWidth(text, 48) + 2 * pad.x));
    const middles = cards.map((card) => card.left + card.width / 2);
    for (const middle of middles) expect(Math.abs(middle - (stack.box.left + stack.box.width / 2))).toBeLessThanOrEqual(0.5);
    expect(cards[2]).toEqual(getDrawnOverlayCard(stack));
  });

  it("grows a stack on the right side from its right edge", () => {
    const cards = getListCardsByItem(list({ ...SHORT, style: { side: "right" } })).map((boxes) => boxes[0] as OverlayBox);
    expect(new Set(cards.map((card) => card.left + card.width)).size).toBe(1);
  });

  it("adds one chip at a time, each already in its final place", () => {
    const chips = list(withLayout(SHORT, "chips"));
    expect(getListCardsByItem(chips)).toEqual([chips.chips?.slice(0, 1), chips.chips?.slice(0, 2), chips.chips]);
  });
});

describe("the render's list", () => {
  it("starts a stack's card at its first point's size and eases it to each next one as the point comes in", () => {
    const stack = list(SHORT, { style: STYLE });
    const cards = getListCardsByItem(stack).map((boxes) => boxes[0] as OverlayBox);
    const { html, tweens } = markup([SHORT]);
    expect(html).toContain(`<div id="ov0" class="clip ov ov-list center"`);
    expect(html).toContain(`<ul class="ov-card grow cen" style="width:${cards[0]?.width}px;height:${cards[0]?.height}px;padding:17px 29px">`);
    expect(html).toContain('<li id="ov0i0">35 zl</li><li id="ov0i1" style="opacity:0">3 days</li><li id="ov0i2" style="opacity:0">county office</li>');
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
    const first = chips.chips?.[0] as OverlayBox;
    const { html, tweens } = markup([withLayout({ ...SHORT, style: { entrance: "wipe" } }, "chips")]);
    expect(html).toContain('<div id="ov0" class="clip ov ov-list chips"');
    expect(html).toContain(`<div class="ov-card ov-chip" id="ov0c0" style="left:${first.left - chips.box.left}px;top:0px;width:${first.width}px;height:${first.height}px;padding:17px 29px"><i class="ov-wipe" id="ov0w0"></i><span>35 zl</span></div>`);
    expect(html).toContain('id="ov0c1" style="left:');
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

  it("draws each chip and its point from the chip's own second, the point centred in it", () => {
    const chips = list(withLayout(SHORT, "chips"), { style: STYLE });
    const lines = draft([withLayout(SHORT, "chips")], null);
    const shapes = lines.filter((line) => line.startsWith("Dialogue: 3,"));
    expect(shapes.map((line) => line.slice(12, 34))).toEqual(["0:00:02.00,0:00:06.00,", "0:00:03.10,0:00:06.00,", "0:00:04.20,0:00:06.00,"]);
    const texts = lines.filter((line) => line.startsWith("Dialogue: 4,"));
    chips.chips?.forEach((chip, index) => expect(texts[index]).toContain(`\\an8\\fs48\\pos(${Math.round(chip.left + chip.width / 2)},${chip.top + 17})`));
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

  it("shows three short points as centred chips appearing in turn", () => {
    const overlay = withLayout(SHORT, "chips");
    const chips = list(overlay, { style: STYLE }).chips as OverlayBox[];
    const shown = [2.6, 3.6, 4.7].map((second) => {
      const frame = grab([overlay], second);
      return chips.map((chip) => isNear(frame, chip.left + 6, chip.top + Math.round(chip.height / 2), COLORS.background) && countText(frame, chip) > 50);
    });
    expect(shown).toEqual([
      [true, false, false],
      [true, true, false],
      [true, true, true],
    ]);
    // The drawn row matches the reported boxes within 2 % of the frame's width, and sits in the middle of the room it may take.
    const frame = grab([overlay], 4.7);
    const span = getCardSpan(frame, (chips[0] as OverlayBox).top + Math.round((chips[0] as OverlayBox).height / 2)) as { left: number; right: number };
    const last = chips[2] as OverlayBox;
    expect(Math.abs(span.left - (chips[0] as OverlayBox).left)).toBeLessThanOrEqual(FRAME.width * 0.02);
    expect(Math.abs(span.right - (last.left + last.width))).toBeLessThanOrEqual(FRAME.width * 0.02);
    const box = list(overlay, { style: STYLE }).box;
    expect(Math.abs((span.left + span.right) / 2 - (box.left + box.width / 2))).toBeLessThanOrEqual(FRAME.width * 0.02);
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
