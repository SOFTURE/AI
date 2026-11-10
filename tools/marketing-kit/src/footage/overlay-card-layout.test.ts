import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { LAYOUTS } from "../compose/timeline.js";
import { FOOTAGE_DRAFT_FONT, buildFootageDraftCaptions } from "./draft.js";
import { type Edl } from "./edl.js";
import { DEFAULT_TRANSITIONS, type FootageFilm } from "./film.js";
import { getOverlayMarkup, getTypingTimes } from "./overlay-html.js";
import { overlaySchema, type EdlOverlay } from "./overlay-schema.js";
import {
  MIN_OVERLAY_SUBTITLE_PX,
  OVERLAY_FONT_SIZES,
  estimateTextWidth,
  getDrawnOverlayCard,
  getOverlayPadding,
  getOverlaySafeZone,
  getTitleContentBox,
  resolveEdlOverlays,
  wrapOverlayText,
  wrapOverlayTitle,
  type ResolveOverlaysInput,
  type ResolvedOverlay,
} from "./overlays.js";
import { readFfmpegListing } from "./tools.js";

/** RV-131 of an adopting app: hook titles and cards fitted to their text, centred while typing, s/m/l scaling the text. */

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
  endCard: null,
};

const FRAME = LAYOUTS["9:16"].frame;
const CAPTION = { top: 1290, bottom: 420, left: 120, right: 120, fontSize: 64 };
const COLORS = { background: "#1d1a2b", foreground: "#fdf7f2", accent: "#e8336b" };
const edlWith = (overlays: EdlOverlay[]): Edl => ({ version: 2, film: "trip", segments: [{ id: "s1", clip: "talk", start: 0, end: 30, transition: "cut", motion: "none" }], overlays });

function resolve(overlays: EdlOverlay[], changes: Partial<ResolveOverlaysInput> = {}) {
  return resolveEdlOverlays({ film, edl: edlWith(overlays), words: [], frame: FRAME, caption: CAPTION, ...changes });
}

function only<K extends ResolvedOverlay["kind"]>(overlay: EdlOverlay, kind: K, changes: Partial<ResolveOverlaysInput> = {}): Extract<ResolvedOverlay, { kind: K }> {
  const result = resolve([overlay], changes);
  if (!result.ok) throw new Error(result.problems.join("; "));
  const [first] = result.overlays;
  if (first?.kind !== kind) throw new Error(`expected a ${kind}`);
  return first as Extract<ResolvedOverlay, { kind: K }>;
}

const TYPED_HOOK: EdlOverlay = { kind: "hook_title", at: 0, duration: 6, text: "Effective plans", style: { entrance: "type", typing_speed: 10 } };
const PLACE: EdlOverlay = { kind: "place_card", at: 1, duration: 3, text: "Ha Long Bay", subtitle: "A bay of 1600 islands" };

describe("the align and subtitle size knobs", () => {
  const issues = (overlay: EdlOverlay) => {
    const result = overlaySchema.safeParse(overlay);
    return result.success ? [] : result.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`);
  };

  it("takes align on a hook title and a place card and subtitle_size on a place card only", () => {
    expect(issues({ ...TYPED_HOOK, style: { align: "left" } })).toEqual([]);
    expect(issues({ ...PLACE, style: { align: "center", subtitle_size: "l" } })).toEqual([]);
    expect(issues({ kind: "keyword", at: 0, duration: 2, text: "2x", style: { align: "left" } })).toEqual(["style.align: only a hook_title or a place_card aligns its lines; leave align out"]);
    expect(issues({ ...TYPED_HOOK, style: { subtitle_size: "s" } })).toEqual(["style.subtitle_size: only a place_card has a subtitle; leave subtitle_size out"]);
    expect(issues({ ...PLACE, style: { align: "right" } } as unknown as EdlOverlay)).toHaveLength(1);
  });
});

describe("fitting a title card to its text", () => {
  it("balances two lines instead of filling the first", () => {
    const text = "How much does a week in Vietnam really cost";
    const greedy = wrapOverlayText(text, 64, 1000);
    const balanced = wrapOverlayTitle(text, 64, 1000);
    expect(greedy).toEqual(["How much does a week in", "Vietnam really cost"]);
    expect(balanced).toEqual(["How much does a week", "in Vietnam really cost"]);
    expect(Math.max(...balanced.map((line) => estimateTextWidth(line, 64)))).toBeLessThan(Math.max(...greedy.map((line) => estimateTextWidth(line, 64))));
    expect(wrapOverlayTitle("Short", 64, 700)).toEqual(["Short"]);
    expect(wrapOverlayTitle("one two three four five six seven eight", 64, 200)).toHaveLength(wrapOverlayText("one two three four five six seven eight", 64, 200).length);
  });

  it("sizes the card to its text and centres it in the frame", () => {
    const hook = only({ kind: "hook_title", at: 0, duration: 3, text: "Two ways" }, "hook_title");
    const padding = getOverlayPadding(hook);
    expect(hook.box.width).toBe(Math.ceil(estimateTextWidth("Two ways", 64) + 2 * padding.x));
    const zone = getOverlaySafeZone(film, FRAME);
    expect(hook.box.left + hook.box.width / 2).toBeCloseTo(zone.left + (FRAME.width - zone.left - zone.right) / 2, -1);
    expect(hook.align).toBe("center");
    expect(getDrawnOverlayCard(hook)).toEqual(hook.box);
  });

  it("scales the text with s, m and l", () => {
    const sizes = (["s", "m", "l"] as const).map((size) => only({ kind: "hook_title", at: 0, duration: 3, text: "Two ways", style: { size } }, "hook_title").fontSize);
    expect(sizes).toEqual([OVERLAY_FONT_SIZES.hook_title.s, OVERLAY_FONT_SIZES.hook_title.m, OVERLAY_FONT_SIZES.hook_title.l]);
    expect(sizes).toEqual([50, 64, 82]);
    const titles = (["s", "m", "l"] as const).map((size) => only({ ...PLACE, style: { size } }, "place_card").fontSize);
    expect(titles).toEqual([70, 92, 118]);
  });

  it("wraps a long title to two lines first and shrinks its font only when two lines are not enough", () => {
    const two = only({ kind: "hook_title", at: 0, duration: 3, text: "Two weeks in Vietnam", style: { size: "l" } }, "hook_title");
    expect(two.lines).toHaveLength(2);
    expect(two.fontSize).toBe(82);
    const long = "Everything we spent on a week in Vietnam";
    const shrunk = only({ kind: "hook_title", at: 0, duration: 3, text: long, style: { size: "l" } }, "hook_title");
    expect(shrunk.lines).toHaveLength(2);
    expect(shrunk.fontSize).toBeLessThan(82);
    expect(shrunk.fontSize).toBeGreaterThanOrEqual(Math.round(Math.round(Math.round(82 * 0.9) * 0.9) * 0.9));
    const content = getTitleContentBox(shrunk);
    expect(content.left).toBeGreaterThanOrEqual(shrunk.box.left);
    expect(content.left + content.width).toBeLessThanOrEqual(shrunk.box.left + shrunk.box.width);
    const refused = resolve([{ kind: "hook_title", at: 0, duration: 3, text: "Supercalifragilisticexpialidocious-unbelievably-long", style: { size: "l" } }]);
    expect(refused).toEqual({ ok: false, problems: ["overlays[0]: the hook title takes more than 2 lines even at a smaller size; shorten it or use a smaller size"] });
  });

  it("draws the place card's subtitle at its own size, never under 2.2 % of the frame's height", () => {
    const subtitle = (style: EdlOverlay["style"]) => only({ ...PLACE, ...(style === undefined ? {} : { style }) }, "place_card").subtitleFontSize;
    expect(subtitle(undefined)).toBe(51);
    const short = (step: "s" | "m" | "l") => only({ ...PLACE, subtitle: "Limestone bay", style: { subtitle_size: step } }, "place_card").subtitleFontSize;
    expect([short("s"), short("m"), short("l")]).toEqual([MIN_OVERLAY_SUBTITLE_PX, 51, 64]);
    expect(subtitle({ size: "s", subtitle_size: "s" })).toBe(MIN_OVERLAY_SUBTITLE_PX);
    for (const size of ["s", "m", "l"] as const) {
      for (const step of ["s", "m", "l"] as const) expect(subtitle({ size, subtitle_size: step }) / FRAME.height).toBeGreaterThanOrEqual(0.022);
    }
    // A long subtitle shrinks to fit the card's room, never below the s step: what fitted before still fits.
    const zone = getOverlaySafeZone(film, FRAME);
    const room = FRAME.width - zone.left - zone.right - 48 - 2 * getOverlayPadding({ fontSize: 92 }).x;
    const long = only({ ...PLACE, subtitle: "Limestone islands in green water" }, "place_card");
    expect(long.subtitleFontSize).toBe(Math.floor(room / (32 * 0.56)));
    expect(long.subtitleFontSize).toBeLessThan(MIN_OVERLAY_SUBTITLE_PX);
    expect(resolve([{ ...PLACE, subtitle: "Limestone islands rising from the sea" }])).toMatchObject({ ok: false });
  });

  it("pads every card by the brand's padding, the drawn card following it", () => {
    const keyword: EdlOverlay = { kind: "keyword", at: 0, duration: 2, text: "2 ways", style: { side: "right" } };
    const plain = only(keyword, "keyword");
    const wide = only(keyword, "keyword", { style: { padding: "l" } });
    const tight = only(keyword, "keyword", { style: { padding: "s" } });
    expect(plain.padScale).toBeUndefined();
    expect(wide.padScale).toBe(1.35);
    expect(getOverlayPadding(wide)).toEqual({ x: Math.round(84 * 0.6 * 1.35), y: Math.round(84 * 0.35 * 1.35) });
    const cards = [tight, plain, wide].map((overlay) => getDrawnOverlayCard(overlay));
    expect(cards.map((card) => card?.width)).toEqual([tight, plain, wide].map((overlay) => Math.ceil(estimateTextWidth("2 ways", 84) + 2 * getOverlayPadding(overlay).x)));
    expect(only(keyword, "keyword", { style: { padding: "m" } }).padScale).toBeUndefined();
    const hook = only({ kind: "hook_title", at: 0, duration: 3, text: "Two ways" }, "hook_title", { style: { padding: "l" } });
    expect(hook.box.width).toBe(Math.ceil(estimateTextWidth("Two ways", 64) + 2 * getOverlayPadding(hook).x));
  });
});

describe("drawing aligned title cards", () => {
  const draft = (overlays: EdlOverlay[]) =>
    (buildFootageDraftCaptions({ film: { ...film, captions: false }, edl: edlWith(overlays), words: [], caption: CAPTION, frame: FRAME, overlays: (resolve(overlays) as { overlays: ResolvedOverlay[] }).overlays, overlayColors: COLORS }) ?? "")
      .split("\n")
      .filter((line) => line.startsWith("Dialogue: 4"));

  it("types a centred title from its card's middle: every step shows only what is typed, on the card's axis", () => {
    const hook = only(TYPED_HOOK, "hook_title");
    const centre = Math.round(hook.box.left + hook.box.width / 2);
    const lines = draft([TYPED_HOOK]);
    const times = getTypingTimes(0, "Effective plans", 10);
    expect(lines).toHaveLength(times.length);
    lines.forEach((line, index) => {
      expect(line).toContain(`\\an8\\fs64\\pos(${centre},`);
      expect(line.endsWith(`}${"Effective plans".slice(0, index + 1).trimEnd()}`)).toBe(true);
      expect(line).not.toContain("\\1a&HFF&");
    });
    expect(lines[0]).toMatch(/^Dialogue: 4,0:00:00\.30,0:00:00\.40,/);
  });

  it("draws a left aligned title and subtitle from the text block's left edge, typing in place", () => {
    const left: EdlOverlay = { ...PLACE, style: { align: "left", entrance: "type" } };
    const card = only(left, "place_card");
    const content = getTitleContentBox(card);
    const lines = draft([left]);
    expect(card.align).toBe("left");
    expect(lines.every((line) => line.includes(`\\an7`) && line.includes(`\\pos(${Math.round(content.left)},`))).toBe(true);
    expect(lines[0]).toMatch(/^Dialogue: 4,0:00:01\.00,.*\{\\1a&HFF&\}Ha Long Bay$/);
    expect(lines.at(-1)).toMatch(/\\fs51.*\}A bay of 1600 islands$/);
    const hook = only({ kind: "hook_title", at: 0, duration: 3, text: "Two ways", place: "Hanoi", style: { align: "left" } }, "hook_title");
    const hookLines = draft([{ kind: "hook_title", at: 0, duration: 3, text: "Two ways", place: "Hanoi", style: { align: "left" } }]);
    const pin = hookLines.find((line) => line.includes("OverlayShape"));
    expect(pin).toContain(`m ${Math.round(getTitleContentBox(hook).left + 12 * (Math.round(hook.placeFontSize * 1.05) / 24))} `);
  });

  it("lays the render's title card out the same way: filling its box, aligned, the untyped characters of a centred line taking no room", () => {
    const hook = only(TYPED_HOOK, "hook_title");
    const content = getTitleContentBox(hook);
    const markup = getOverlayMarkup([hook, only({ ...PLACE, style: { align: "left" } }, "place_card")], { colors: COLORS, headingFont: "Head", frame: FRAME });
    const html = markup.html.join("\n");
    expect(markup.css).toContain(".ty .ov-stack:not(.left) .ch{display:none}");
    expect(markup.css.some((rule) => rule.startsWith(".ov-stack{") && rule.includes("width:100%;height:100%"))).toBe(true);
    expect(html).toContain(`<div class="ov-card ov-stack" style="padding:${Math.round((content.top - hook.box.top) * 1000) / 1000}px ${Math.round((content.left - hook.box.left) * 1000) / 1000}px">`);
    expect(html).toContain('<div class="ov-card ov-stack left" style="padding:');
    expect(markup.tweens.join("\n")).toContain('display: "inline"');
    const padded = only({ kind: "keyword", at: 0, duration: 2, text: "2 ways" }, "keyword", { style: { padding: "l" } });
    const pad = getOverlayPadding(padded);
    expect(getOverlayMarkup([padded], { colors: COLORS, headingFont: "Head", frame: FRAME }).html.join("")).toContain(`style="padding:${pad.y}px ${pad.x}px"`);
  });
});

const canBurn = (() => {
  const run = spawnSync("ffmpeg", ["-hide_banner", "-filters"], { encoding: "utf8" });
  return run.status === 0 && readFfmpegListing(run.stdout).has("ass");
})();

describe.skipIf(!canBurn)("a typed hook title burned in by libass", () => {
  let dir = "";
  afterEach(() => {
    if (dir !== "") rmSync(dir, { recursive: true, force: true });
    dir = "";
  });

  function grabFrame(overlays: EdlOverlay[], seconds: number): Buffer {
    dir = dir === "" ? mkdtempSync(join(tmpdir(), "overlay-card-layout-")) : dir;
    const resolved = resolve(overlays) as { overlays: ResolvedOverlay[] };
    const ass = buildFootageDraftCaptions({ film: { ...film, captions: false }, edl: edlWith(overlays), words: [], caption: CAPTION, frame: FRAME, overlays: resolved.overlays, overlayColors: COLORS }) ?? "";
    writeFileSync(join(dir, "captions.ass"), ass);
    mkdirSync(join(dir, "fonts"), { recursive: true });
    copyFileSync(FOOTAGE_DRAFT_FONT.file, join(dir, "fonts", basename(FOOTAGE_DRAFT_FONT.file)));
    const run = spawnSync(
      "ffmpeg",
      ["-v", "error", "-f", "lavfi", "-i", `color=c=0x3366aa:s=${FRAME.width}x${FRAME.height}:d=10:r=30`, "-ss", String(seconds), "-vf", "ass=captions.ass:fontsdir=fonts", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
      { cwd: dir, maxBuffer: FRAME.width * FRAME.height * 3 + 1024 },
    );
    expect(run.status, run.stderr.toString()).toBe(0);
    return run.stdout;
  }

  /** The columns of the card's rows where the text's light ink shows, or null when none does. */
  function findInk(frame: Buffer, box: { left: number; top: number; width: number; height: number }): { left: number; right: number } | null {
    let [left, right] = [Infinity, -Infinity];
    for (let y = box.top; y < box.top + box.height; y++) {
      for (let x = box.left; x < box.left + box.width; x++) {
        const at = (y * FRAME.width + x) * 3;
        if ((frame[at] ?? 0) > 200 && (frame[at + 1] ?? 0) > 200 && (frame[at + 2] ?? 0) > 200) [left, right] = [Math.min(left, x), Math.max(right, x)];
      }
    }
    return left === Infinity ? null : { left, right };
  }

  it("keeps the typed text centred in its card in every typing frame, the card as wide as the whole title", () => {
    const hook = only(TYPED_HOOK, "hook_title");
    const cardCentre = hook.box.left + hook.box.width / 2;
    const times = getTypingTimes(0, "Effective plans", 10);
    for (const index of [0, 4, 9, times.length - 1]) {
      const frame = grabFrame([TYPED_HOOK], (times[index] as number) + 0.05);
      const ink = findInk(frame, hook.box);
      expect(ink, `frame after character ${index + 1}`).not.toBeNull();
      const inkCentre = ((ink?.left ?? 0) + (ink?.right ?? 0)) / 2;
      expect(Math.abs(inkCentre - cardCentre) / FRAME.width, `frame after character ${index + 1}`).toBeLessThanOrEqual(0.02);
    }
    // The card keeps its width while it types: its left edge is the card's colour from the first frame on.
    const early = grabFrame([TYPED_HOOK], (times[0] as number) + 0.05);
    const at = ((hook.box.top + Math.round(hook.box.height / 2)) * FRAME.width + hook.box.left + 4) * 3;
    expect([early[at], early[at + 1], early[at + 2]].every((value, channel) => Math.abs((value ?? 0) - [0x1d, 0x1a, 0x2b][channel]!) <= 40)).toBe(true);
  });
});
